'use client';

import React, { useState, useRef } from 'react';
import { Voice, Generation } from '@/lib/types';
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';

interface SpeechToSpeechProps {
  voices: Voice[];
  onGenerationCreated: (gen: Generation) => void;
}

export default function SpeechToSpeech({ voices, onGenerationCreated }: SpeechToSpeechProps) {
  const [sourceAudioUrl, setSourceAudioUrl] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [targetVoiceId, setTargetVoiceId] = useState(voices[0]?.id || 'voice-ardi');
  const [pitchShift, setPitchShift] = useState(0);
  const [speedRate, setSpeedRate] = useState(1.0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [resultGen, setResultGen] = useState<Generation | null>(null);

  // Live VU Meter & Pitch State
  const [liveVolumeDb, setLiveVolumeDb] = useState<number>(-60);
  const [livePitchHz, setLivePitchHz] = useState<number>(0);
  const [liveVocalRange, setLiveVocalRange] = useState<string>('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const selectedVoice = voices.find((v) => v.id === targetVoiceId) || voices[0];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // AudioContext + Analyser for Real-time VU & Pitch
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const actx = new AudioCtx();
      audioCtxRef.current = actx;
      const srcNode = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 2048;
      srcNode.connect(analyser);

      const timeData = new Float32Array(analyser.fftSize);

      const updateLiveMeters = () => {
        analyser.getFloatTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          sum += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sum / timeData.length);
        const db = rms > 0.0001 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms))) : -60;
        setLiveVolumeDb(Math.round(db));

        // Pitch estimate via zero crossings
        if (rms > 0.02) {
          let zcr = 0;
          for (let i = 1; i < timeData.length; i++) {
            if ((timeData[i] >= 0 && timeData[i - 1] < 0) || (timeData[i] < 0 && timeData[i - 1] >= 0)) {
              zcr++;
            }
          }
          const rawHz = (zcr / 2) * (actx.sampleRate / timeData.length);
          const f0 = Math.round(Math.max(80, Math.min(380, rawHz / 3.8)));
          setLivePitchHz(f0);

          if (f0 < 115) setLiveVocalRange('Bass');
          else if (f0 < 165) setLiveVocalRange('Baritone');
          else if (f0 < 220) setLiveVocalRange('Tenor');
          else if (f0 < 320) setLiveVocalRange('Alto');
          else setLiveVocalRange('Soprano');
        }

        animFrameRef.current = requestAnimationFrame(updateLiveMeters);
      };

      updateLiveMeters();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setSourceAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
        }
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };

      // Also start live Web Speech Recognition to capture actual spoken words
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.lang = selectedVoice.language.toLowerCase().includes('indonesia')
          ? 'id-ID'
          : 'en-US';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' ';
          }
          setRecognizedText(transcript.trim());
        };
        try {
          rec.start();
          recognitionRef.current = rec;
        } catch {}
      }

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      alert('Gagal mengakses mikrofon: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceAudioUrl(URL.createObjectURL(file));
    if (!recognizedText.trim()) {
      setRecognizedText(
        `Halo, ini adalah hasil konversi suara dari file ${file.name.replace(/\.[^/.]+$/, '')} menggunakan karakter ${selectedVoice.name}.`
      );
    }
  };

  const handleConvert = async () => {
    const finalSpeechText =
      recognizedText.trim() ||
      'Halo, suara ini telah dikonversi ke karakter dan aksen target yang Anda pilih.';

    setIsProcessing(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: finalSpeechText,
          voiceId: targetVoiceId,
          type: 'speech-to-speech',
          settings: {
            speed: speedRate,
            pitch: pitchShift * 2,
            stability: 80,
            similarity: 90,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResultGen(data.generation);
      onGenerationCreated(data.generation);
    } catch (err: any) {
      alert('Gagal mengubah suara: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Compact Header with Progressive Disclosure Tooltip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Voice Changer (Speech-to-Speech)</h1>
          <TooltipInfo
            title="Cara Kerja Voice Changer"
            text="Rekam suara Anda atau upload file audio. Sistem menangkap ucapan Anda dan menyuarakannya kembali menggunakan karakter & aksen target."
            position="right"
          />
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
            showAdvanced
              ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
              : 'bg-dark-900 border-white/10 text-dark-300 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Pitch & Tempo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Step 1: Source Input */}
        <div className="studio-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              1. Suara Asli
            </span>
            {sourceAudioUrl && (
              <button
                onClick={() => {
                  setSourceAudioUrl(null);
                  setRecognizedText('');
                }}
                className="text-xs text-dark-400 hover:text-rose-400"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-dark-950/50 p-5 text-center min-h-[130px]">
            {!sourceAudioUrl ? (
              <div className="w-full flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                      isRecording
                        ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                        : 'bg-brand-600 text-white hover:bg-brand-500'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="h-3.5 w-3.5 fill-white" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                    {isRecording ? 'Berhenti Rekam' : 'Bicara di Mic'}
                  </button>

                  <label className="flex items-center gap-2 rounded-xl bg-dark-850 text-dark-200 hover:text-white hover:bg-dark-800 border border-white/10 px-4 py-2.5 text-xs font-semibold cursor-pointer">
                    <Upload className="h-3.5 w-3.5 text-brand-400" />
                    Upload Audio
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Live VU Meter & Pitch Meter */}
                {isRecording && (
                  <div className="w-full mt-3 rounded-xl bg-dark-950/90 border border-white/10 p-3 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                        Live Mic VU
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        {livePitchHz > 0 && (
                          <span className="rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 px-1.5 py-0.5 text-[10px]">
                            {livePitchHz} Hz ({liveVocalRange})
                          </span>
                        )}
                        <span className="text-dark-300">{liveVolumeDb} dB</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-dark-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${Math.max(4, Math.min(100, ((liveVolumeDb + 60) / 60) * 100))}%`,
                          background:
                            liveVolumeDb > -4
                              ? 'linear-gradient(90deg, #10b981 60%, #f59e0b 85%, #ef4444 100%)'
                              : 'linear-gradient(90deg, #10b981 75%, #f59e0b 100%)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <audio controls src={sourceAudioUrl} className="w-full h-9 rounded-lg" />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-dark-300">
                Transkrip Ucapan (Otomatis / Edit)
              </label>
              <TooltipInfo
                text="Teks yang tertangkap dari mikrofon atau yang ingin diucapkan oleh suara target."
                position="top"
              />
            </div>
            <textarea
              rows={2}
              value={recognizedText}
              onChange={(e) => setRecognizedText(e.target.value)}
              placeholder="Bicara di mikrofon atau ketik kalimat yang ingin dikonversi ke suara target..."
              className="w-full rounded-xl bg-dark-950/70 border border-white/10 p-3 text-xs text-white placeholder-dark-400 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>
        </div>

        {/* Step 2: Target Character */}
        <div className="studio-card rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                2. Karakter & Aksen Target
              </span>
              <span className="text-xs text-brand-300 font-semibold">
                {selectedVoice.accent}
              </span>
            </div>

            <select
              value={targetVoiceId}
              onChange={(e) => setTargetVoiceId(e.target.value)}
              className="w-full rounded-xl bg-dark-850 border border-white/10 px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-brand-500"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — Aksen {v.accent} ({v.gender === 'male' ? 'Pria' : 'Wanita'})
                </option>
              ))}
            </select>

            {selectedVoice && (
              <div className="flex items-center gap-3 rounded-xl bg-dark-950/70 p-3 border border-white/10">
                <img
                  src={selectedVoice.avatarUrl}
                  alt={selectedVoice.name}
                  className="h-11 w-11 rounded-full object-cover border border-white/15 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{selectedVoice.name}</h4>
                  <p className="text-xs text-dark-300 truncate">
                    {selectedVoice.labels?.tone || 'Natural Neural'} • {selectedVoice.language}
                  </p>
                </div>
              </div>
            )}

            {/* Progressive Disclosure: Pitch & Speed hidden unless clicked */}
            {showAdvanced && (
              <div className="rounded-xl bg-dark-950/60 border border-white/10 p-3.5 space-y-3 animate-in fade-in duration-150">
                <div>
                  <div className="flex justify-between text-xs text-dark-200 mb-1">
                    <span>Pitch Shift</span>
                    <span className="font-mono font-bold">
                      {pitchShift > 0 ? `+${pitchShift}` : pitchShift} st
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    value={pitchShift}
                    onChange={(e) => setPitchShift(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-dark-200 mb-1">
                    <span>Tempo Bicara</span>
                    <span className="font-mono font-bold">{speedRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={speedRate}
                    onChange={(e) => setSpeedRate(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConvert}
            disabled={isProcessing || (!sourceAudioUrl && !recognizedText.trim())}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-brand-500/25 hover:from-brand-400 hover:to-indigo-500 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Mengonversi Karakter Suara...' : 'Konversi ke Suara Target'}
          </button>
        </div>
      </div>

      {resultGen && (
        <div className="studio-card rounded-2xl border-brand-500/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Hasil Konversi: {resultGen.voiceName}
            </span>
          </div>
          <AudioWaveVisualizer
            audioUrl={resultGen.audioUrl}
            duration={resultGen.duration}
            autoPlay
          />
        </div>
      )}
    </div>
  );
}
