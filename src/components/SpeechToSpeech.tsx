'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Voice, Generation } from '@/lib/types';
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Wand2,
  Languages,
  Loader2,
  RotateCcw,
  FileAudio,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';
import PageHeader from './PageHeader';
import { toast } from '@/lib/toast';
import { haptic } from '@/lib/haptics';
import { blobToBase64 } from '@/lib/audio-dsp';
import {
  DEFAULT_VC,
  VOICE_PRESETS,
  VoiceChangerSettings,
  renderVoiceChange,
  transcribeBlobLocally,
} from '@/lib/voice-changer';

interface SpeechToSpeechProps {
  voices: Voice[];
  onGenerationCreated: (gen: Generation) => void;
}

type Mode = 'effect' | 'character';

export default function SpeechToSpeech({ voices, onGenerationCreated }: SpeechToSpeechProps) {
  const [mode, setMode] = useState<Mode>('effect');
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [sourceAudioUrl, setSourceAudioUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('rekaman-mic');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [liveVolumeDb, setLiveVolumeDb] = useState<number>(-60);

  // Effect mode
  const [presetId, setPresetId] = useState('female');
  const [vc, setVc] = useState<VoiceChangerSettings>({ ...DEFAULT_VC, ...VOICE_PRESETS[1].settings });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Character mode
  const [recognizedText, setRecognizedText] = useState('');
  const [targetVoiceId, setTargetVoiceId] = useState(voices[0]?.id || 'voice-ardi');
  const [sourceLang, setSourceLang] = useState('Indonesian');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speedRate, setSpeedRate] = useState(1.0);
  const [pitchShift, setPitchShift] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [resultGen, setResultGen] = useState<Generation | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const selectedVoice = voices.find((v) => v.id === targetVoiceId) || voices[0];

  useEffect(() => {
    if (!voices.find((v) => v.id === targetVoiceId) && voices[0]) setTargetVoiceId(voices[0].id);
  }, [voices, targetVoiceId]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const setSource = (blob: Blob, name: string) => {
    if (sourceAudioUrl) URL.revokeObjectURL(sourceAudioUrl);
    setSourceBlob(blob);
    setSourceAudioUrl(URL.createObjectURL(blob));
    setSourceName(name);
    setResultGen(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(
        (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)
      );
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const actx: AudioContext = new AudioCtx();
      audioCtxRef.current = actx;
      const analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      actx.createMediaStreamSource(stream).connect(analyser);
      const timeData = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
        const rms = Math.sqrt(sum / timeData.length);
        setLiveVolumeDb(rms > 0.0001 ? Math.round(Math.max(-60, 20 * Math.log10(rms))) : -60);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setSource(blob, `rekaman-mic-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`);
        stream.getTracks().forEach((t) => t.stop());
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };

      // Live captions while speaking (Chrome/Edge/Safari) — the local Whisper pass is used otherwise
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec && mode === 'character') {
        const rec = new SpeechRec();
        rec.lang = sourceLang === 'English' ? 'en-US' : 'id-ID';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript + ' ';
          setRecognizedText(transcript.trim());
        };
        rec.onerror = () => {};
        try {
          rec.start();
          recognitionRef.current = rec;
        } catch {}
      }

      mediaRecorder.start();
      setRecordSec(0);
      timerRef.current = setInterval(() => setRecordSec((s) => s + 1), 1000);
      setIsRecording(true);
      haptic(10);
    } catch (err: any) {
      toast('Gagal mengakses mikrofon: ' + (err?.message || err), 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      toast('File terlalu besar (maks 60MB)', 'error');
      return;
    }
    setSource(file, file.name.replace(/\.[^/.]+$/, ''));
  };

  const applyPreset = (id: string) => {
    haptic(6);
    const p = VOICE_PRESETS.find((x) => x.id === id);
    setPresetId(id);
    setVc({ ...DEFAULT_VC, ...(p?.settings || {}) });
  };

  const handleTranscribe = async () => {
    if (!sourceBlob) return;
    setIsTranscribing(true);
    try {
      toast('Mentranskrip dengan Whisper lokal… (pertama kali: unduh model ±80MB)', 'info');
      const text = await transcribeBlobLocally(sourceBlob, sourceLang);
      if (!text) throw new Error('Tidak ada ucapan yang terdeteksi');
      setRecognizedText(text);
      toast('Transkrip selesai');
    } catch (err: any) {
      toast('Transkripsi gagal: ' + err.message, 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleConvertEffect = async () => {
    if (!sourceBlob) return;
    setIsProcessing(true);
    try {
      const { wavBlob, duration } = await renderVoiceChange(sourceBlob, vc);
      const base64 = await blobToBase64(wavBlob);
      const preset = VOICE_PRESETS.find((p) => p.id === presetId);
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          category: 'speech2speech',
          filename: `${sourceName}-${preset?.id || 'custom'}`,
          type: 'speech-to-speech',
          text: `Ubah Suara: ${preset ? `${preset.emoji} ${preset.label}` : 'Kustom'} — ${sourceName} (pitch ${vc.pitch > 0 ? '+' : ''}${vc.pitch} st, tempo ${vc.tempo.toFixed(2)}x)`,
          voiceName: `Voice Changer · ${preset?.label || 'Kustom'}`,
          voiceId: 'voice-changer',
          duration,
          model: 'Local Granular Pitch-Shift DSP',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultGen(data.generation);
      onGenerationCreated(data.generation);
      haptic([10, 40, 10]);
      toast('Suara berhasil diubah');
    } catch (err: any) {
      toast('Gagal mengubah suara: ' + (err?.message || 'format audio tidak didukung browser'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertCharacter = async () => {
    let text = recognizedText.trim();
    setIsProcessing(true);
    try {
      if (!text && sourceBlob) {
        setIsTranscribing(true);
        try {
          text = await transcribeBlobLocally(sourceBlob, sourceLang);
          setRecognizedText(text);
        } finally {
          setIsTranscribing(false);
        }
      }
      if (!text) throw new Error('Transkrip kosong. Rekam/upload audio atau ketik teksnya.');

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: targetVoiceId,
          type: 'speech-to-speech',
          settings: { speed: speedRate, pitch: pitchShift * 2, stability: 80, similarity: 90 },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultGen(data.generation);
      onGenerationCreated(data.generation);
      haptic([10, 40, 10]);
    } catch (err: any) {
      toast('Gagal mengubah suara: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const slider = (
    label: string,
    value: number,
    display: string,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void
  ) => (
    <div>
      <div className="flex justify-between text-xs text-dark-200 mb-1">
        <span>{label}</span>
        <span className="font-mono font-bold">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          setPresetId('custom');
          onChange(parseFloat(e.target.value));
        }}
        className="w-full"
      />
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      <PageHeader
        title="Voice Changer (Ubah Suara)"
        mobileTitle="Ubah Suara"
        subtitle="Ubah suara asli Anda dengan efek, atau suarakan ulang dengan karakter AI."
        titleAddon={
          <TooltipInfo
            title="Dua Mode Ubah Suara"
            text="Efek Suara: memproses suara asli Anda langsung (pitch, robot, echo) — 100% lokal di browser. Karakter AI: ucapan Anda ditranskrip oleh Whisper lokal lalu dibacakan ulang oleh suara neural pilihan."
            position="right"
          />
        }
      />

      {/* Mode switch — lightweight pill without heavy outer border */}
      <div className="grid grid-cols-2 w-full sm:w-auto sm:inline-grid rounded-xl bg-white/[0.05] p-1">
        {(
          [
            { id: 'effect', label: 'Efek Suara', icon: Wand2 },
            { id: 'character', label: 'Karakter AI', icon: Languages },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => {
              haptic();
              setMode(m.id);
              setResultGen(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 h-9 text-[13px] font-semibold transition-colors ${
              mode === m.id ? 'bg-white text-black' : 'text-dark-300 hover:text-white'
            }`}
          >
            <m.icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
        {/* Step 1: Source */}
        <div className="studio-card rounded-2xl p-3.5 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-dark-300 uppercase tracking-wider">1. Suara Asli</span>
            {sourceAudioUrl && !isRecording && (
              <button
                onClick={() => {
                  setSourceBlob(null);
                  setSourceAudioUrl(null);
                  setRecognizedText('');
                  setResultGen(null);
                }}
                className="text-xs text-dark-400 hover:text-rose-400"
              >
                Hapus
              </button>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-white/[0.03] p-3 text-center">
            <div className="grid grid-cols-2 w-full gap-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center justify-center gap-1.5 h-11 rounded-xl px-3 text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                    : 'bg-brand-600 text-white hover:bg-brand-500'
                }`}
              >
                {isRecording ? <Square className="h-3.5 w-3.5 fill-white" /> : <Mic className="h-4 w-4 shrink-0" />}
                {isRecording ? `Stop (${recordSec}s)` : sourceAudioUrl ? 'Rekam Lagi' : 'Rekam'}
              </button>
              <label
                className={`flex items-center justify-center gap-1.5 h-11 rounded-xl bg-white/[0.07] text-white hover:bg-white/[0.12] px-3 text-[13px] font-semibold whitespace-nowrap cursor-pointer active:scale-95 transition-all ${
                  isRecording ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                <Upload className="h-4 w-4 shrink-0 text-brand-300" />
                Upload
                <input type="file" accept="audio/*,video/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {isRecording && (
              <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75"
                  style={{ width: `${Math.max(4, Math.min(100, ((liveVolumeDb + 60) / 60) * 100))}%` }}
                />
              </div>
            )}

            {sourceAudioUrl && !isRecording && (
              <div className="w-full space-y-1.5">
                <div className="flex items-center gap-1.5 text-[12px] text-dark-300 truncate">
                  <FileAudio className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                  <span className="truncate">{sourceName}</span>
                </div>
                <audio controls src={sourceAudioUrl} className="w-full h-9 rounded-lg" />
              </div>
            )}
            {!sourceAudioUrl && !isRecording && (
              <p className="text-[11.5px] text-dark-500">MP3, WAV, M4A, MP4</p>
            )}
          </div>

          {mode === 'character' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-dark-300">Transkrip Ucapan</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="rounded-lg bg-dark-850 border border-white/10 px-2 h-8 text-[12px] text-white"
                    title="Bahasa ucapan asli"
                  >
                    <option value="Indonesian">🇮🇩 Indonesia</option>
                    <option value="English">🇺🇸 English</option>
                    <option value="Japanese">🇯🇵 Jepang</option>
                    <option value="Korean">🇰🇷 Korea</option>
                    <option value="Arabic">🇸🇦 Arab</option>
                    <option value="auto">🌐 Deteksi Otomatis</option>
                  </select>
                  <button
                    onClick={handleTranscribe}
                    disabled={!sourceBlob || isTranscribing || isRecording}
                    className="flex items-center gap-1 rounded-lg bg-brand-500/20 border border-brand-500/40 px-2.5 h-8 text-[12px] font-semibold text-brand-200 disabled:opacity-40"
                  >
                    {isTranscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Transkrip
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={recognizedText}
                onChange={(e) => setRecognizedText(e.target.value)}
                placeholder="Teks hasil transkrip muncul di sini (bisa diedit), atau ketik langsung kalimat yang ingin diucapkan karakter target…"
                className="w-full rounded-xl bg-dark-950/70 border border-white/10 p-3 text-sm sm:text-xs text-white placeholder-dark-400 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="studio-card rounded-2xl p-3.5 sm:p-5 space-y-3.5 flex flex-col justify-between">
          {mode === 'effect' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-dark-300 uppercase tracking-wider">2. Pilih Efek</span>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 h-9 text-[12px] font-semibold transition-colors ${
                    showAdvanced ? 'bg-brand-500/25 text-brand-200' : 'bg-white/[0.05] text-dark-300'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Manual
                </button>
              </div>
              {/* Horizontal swipe on mobile so CTA stays above the fold; 4-col grid on desktop */}
              <div className="flex sm:grid sm:grid-cols-4 gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {VOICE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    title={p.desc}
                    className={`flex shrink-0 w-[82px] sm:w-auto flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition-all active:scale-95 ${
                      presetId === p.id
                        ? 'bg-brand-500/25 ring-1 ring-brand-400 text-white'
                        : 'bg-white/[0.04] text-dark-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="text-xl leading-none">{p.emoji}</span>
                    <span className="text-[11px] font-semibold leading-tight text-center whitespace-nowrap">{p.label}</span>
                  </button>
                ))}
              </div>

              {showAdvanced && (
                <div className="rounded-xl bg-dark-950/60 border border-white/10 p-3.5 space-y-3">
                  {slider('Pitch (nada)', vc.pitch, `${vc.pitch > 0 ? '+' : ''}${vc.pitch} st`, -12, 12, 1, (v) => setVc({ ...vc, pitch: v }))}
                  {slider('Tempo', vc.tempo, `${vc.tempo.toFixed(2)}x`, 0.6, 1.6, 0.05, (v) => setVc({ ...vc, tempo: v }))}
                  {slider('Robot', vc.robot, `${vc.robot}%`, 0, 100, 5, (v) => setVc({ ...vc, robot: v }))}
                  {slider('Echo', vc.echo, `${vc.echo}%`, 0, 100, 5, (v) => setVc({ ...vc, echo: v }))}
                  {slider('Reverb', vc.reverb, `${vc.reverb}%`, 0, 100, 5, (v) => setVc({ ...vc, reverb: v }))}
                  {slider('Distorsi', vc.distortion, `${vc.distortion}%`, 0, 100, 5, (v) => setVc({ ...vc, distortion: v }))}
                  {slider('Kecerahan', vc.brightness, `${vc.brightness > 0 ? '+' : ''}${vc.brightness} dB`, -12, 12, 1, (v) => setVc({ ...vc, brightness: v }))}
                  <label className="flex items-center justify-between text-xs text-dark-200">
                    <span>Filter Telepon / Radio</span>
                    <input
                      type="checkbox"
                      checked={vc.telephone}
                      onChange={(e) => {
                        setPresetId('custom');
                        setVc({ ...vc, telephone: e.target.checked });
                      }}
                    />
                  </label>
                  <button
                    onClick={() => applyPreset('normal')}
                    className="flex items-center gap-1 text-[12px] text-dark-400 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider min-w-0">2. Karakter Target</span>
                <span className="text-xs text-brand-300 font-semibold truncate">{selectedVoice?.accent}</span>
              </div>
              <select
                value={targetVoiceId}
                onChange={(e) => setTargetVoiceId(e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-white/10 px-3.5 h-11 text-xs font-semibold text-white focus:outline-none focus:border-brand-500"
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.accent} ({v.gender === 'male' ? 'Pria' : v.gender === 'female' ? 'Wanita' : 'Netral'})
                  </option>
                ))}
              </select>
              {selectedVoice && (
                <div className="flex items-center gap-3 rounded-xl bg-dark-950/70 p-3 border border-white/10">
                  <img src={selectedVoice.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover border border-white/15 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{selectedVoice.name}</h4>
                    <p className="text-xs text-dark-300 truncate">
                      {selectedVoice.labels?.tone || 'Natural Neural'} • {selectedVoice.language}
                    </p>
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-dark-950/60 border border-white/10 p-3.5 space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-dark-200 mb-1">
                    <span>Pitch</span>
                    <span className="font-mono font-bold">{pitchShift > 0 ? `+${pitchShift}` : pitchShift}</span>
                  </div>
                  <input type="range" min="-12" max="12" value={pitchShift} onChange={(e) => setPitchShift(parseInt(e.target.value))} className="w-full" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-dark-200 mb-1">
                    <span>Tempo Bicara</span>
                    <span className="font-mono font-bold">{speedRate.toFixed(2)}x</span>
                  </div>
                  <input type="range" min="0.6" max="1.6" step="0.05" value={speedRate} onChange={(e) => setSpeedRate(parseFloat(e.target.value))} className="w-full" />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={mode === 'effect' ? handleConvertEffect : handleConvertCharacter}
            disabled={
              isProcessing ||
              isRecording ||
              (mode === 'effect' ? !sourceBlob : !sourceBlob && !recognizedText.trim())
            }
            className="w-full flex items-center justify-center gap-2 rounded-2xl sm:rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-5 h-12 text-sm font-bold text-white shadow-lg shadow-brand-500/25 hover:from-brand-400 hover:to-indigo-500 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing
              ? isTranscribing
                ? 'Mentranskrip ucapan…'
                : 'Memproses suara…'
              : mode === 'effect'
                ? 'Ubah Suara Sekarang'
                : 'Suarakan dengan Karakter'}
          </button>
        </div>
      </div>

      {resultGen && (
        <div className="studio-card rounded-2xl border-brand-500/40 p-4 sm:p-5 space-y-3">
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            Hasil: {resultGen.voiceName}
          </span>
          <AudioWaveVisualizer
            audioUrl={resultGen.audioUrl}
            duration={resultGen.duration}
            autoPlay
            fileName={`${resultGen.voiceName.replace(/[^\w-]+/g, '-')}-${resultGen.id}.${resultGen.audioUrl.endsWith('.wav') || resultGen.audioUrl.startsWith('data:audio/wav') ? 'wav' : 'mp3'}`}
          />
        </div>
      )}
    </div>
  );
}
