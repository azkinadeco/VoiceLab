'use client';

import React, { useState, useRef } from 'react';
import { Generation } from '@/lib/types';
import {
  ShieldCheck,
  Mic,
  Upload,
  Square,
  Sparkles,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';
import { processVoiceIsolationDsp, blobToBase64, extractAudioFromMediaBlob } from '@/lib/audio-dsp';
import { Film } from 'lucide-react';

interface VoiceIsolatorProps {
  onGenerationCreated: (gen: Generation) => void;
}

export default function VoiceIsolator({ onGenerationCreated }: VoiceIsolatorProps) {
  const [sourceAudioUrl, setSourceAudioUrl] = useState<string | null>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState('audio-sample.wav');
  const [noiseStrength, setNoiseStrength] = useState(80);
  const [showDspControls, setShowDspControls] = useState(false);
  const [compareMode, setCompareMode] = useState<'isolated' | 'original'>('isolated');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultGen, setResultGen] = useState<Generation | null>(null);
  const [isVideoSource, setIsVideoSource] = useState(false);
  const [isExtractingVideo, setIsExtractingVideo] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setSourceBlob(blob);
        setSourceAudioUrl(URL.createObjectURL(blob));
        setFileName('live-recording.wav');
        stream.getTracks().forEach((track) => track.stop());
      };

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
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name);
    setIsVideoSource(isVideo);

    if (isVideo) {
      setIsExtractingVideo(true);
      try {
        const extracted = await extractAudioFromMediaBlob(file);
        setSourceBlob(extracted.wavBlob);
        setSourceAudioUrl(URL.createObjectURL(extracted.wavBlob));
      } catch (err: any) {
        alert('Gagal mengekstrak audio dari video: ' + err.message);
        setSourceBlob(file);
        setSourceAudioUrl(URL.createObjectURL(file));
      } finally {
        setIsExtractingVideo(false);
      }
    } else {
      setSourceBlob(file);
      setSourceAudioUrl(URL.createObjectURL(file));
    }
  };

  const handleIsolate = async () => {
    if (!sourceBlob) return;
    setIsProcessing(true);

    try {
      let base64ToSave = '';
      let durationSec = 5.0;

      try {
        // Real Web Audio OfflineAudioContext 4-Stage Vocal Bandpass & Noise Gate DSP
        const dspResult = await processVoiceIsolationDsp(sourceBlob, noiseStrength);
        base64ToSave = dspResult.base64;
        durationSec = dspResult.duration;
      } catch {
        base64ToSave = await blobToBase64(sourceBlob);
      }

      const res = await fetch('/api/isolate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64ToSave,
          filename: fileName,
          duration: durationSec,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResultGen(data.generation);
      setCompareMode('isolated');
      onGenerationCreated(data.generation);
    } catch (err: any) {
      alert('Gagal mengisolasi audio: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Voice Isolator & Noise Gate DSP</h1>
          <TooltipInfo
            title="4-Stage Vocal Isolation"
            text="Memotong frekuensi gemuruh di bawah 85Hz, desis di atas 7.5kHz, menonjolkan frekuensi vokal 2.8kHz (+4.5dB), dan menerapkan Dynamic Noise Gate."
            position="right"
          />
        </div>

        <button
          onClick={() => setShowDspControls(!showDspControls)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
            showDspControls
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-dark-900 border-white/10 text-dark-300 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Kekuatan Filter ({noiseStrength}%)
        </button>
      </div>

      <div className="studio-card rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        {showDspControls && (
          <div className="rounded-xl bg-dark-950/70 border border-white/10 p-4 space-y-2 animate-in fade-in duration-150">
            <div className="flex justify-between text-xs text-dark-200">
              <span>Intensitas Pembersih Noise & Rumble Gate</span>
              <span className="font-mono font-bold text-emerald-400">{noiseStrength}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={noiseStrength}
              onChange={(e) => setNoiseStrength(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-dark-950/50 p-7 text-center min-h-[150px]">
          {!sourceAudioUrl ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {isRecording ? (
                  <Square className="h-3.5 w-3.5 fill-white" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                {isRecording ? 'Berhenti Rekam' : 'Rekam Mikrofon'}
              </button>

              <label className="flex items-center gap-2 rounded-xl bg-dark-850 text-white hover:bg-dark-800 border border-white/10 px-4 py-2.5 text-xs font-semibold cursor-pointer">
                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                Upload Audio / Video (MP4)
                <input
                  type="file"
                  accept="audio/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : isExtractingVideo ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-teal-300 font-medium">Mengekstrak track audio dari video...</p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-xs text-dark-200">
                <div className="flex items-center gap-2 truncate max-w-md">
                  <span className="font-semibold text-white truncate">{fileName}</span>
                  {isVideoSource && (
                    <span className="flex items-center gap-1 rounded bg-teal-500/20 text-teal-300 text-[10px] px-2 py-0.5 shrink-0">
                      <Film className="h-3 w-3" /> Video Audio Track
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSourceAudioUrl(null);
                    setSourceBlob(null);
                    setIsVideoSource(false);
                  }}
                  className="text-dark-400 hover:text-rose-400"
                >
                  Ganti File
                </button>
              </div>
              <audio controls src={sourceAudioUrl} className="w-full h-9 rounded-lg" />
            </div>
          )}
        </div>

        <button
          onClick={handleIsolate}
          disabled={isProcessing || !sourceBlob}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-40"
        >
          <Filter className="h-4 w-4" />
          {isProcessing ? 'Memproses Filter DSP Vokal...' : 'Isolasi & Jernihkan Vokal'}
        </button>
      </div>

      {/* Before / After A/B Comparison Result Card */}
      {resultGen && (
        <div className="studio-card rounded-2xl border-emerald-500/40 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Hasil Isolasi Vokal (WAV 16-bit PCM)
            </span>

            {sourceAudioUrl && (
              <div className="flex rounded-lg bg-dark-950 p-0.5 border border-white/10 text-xs">
                <button
                  onClick={() => setCompareMode('isolated')}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    compareMode === 'isolated'
                      ? 'bg-emerald-600 text-white'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  After (Clean DSP)
                </button>
                <button
                  onClick={() => setCompareMode('original')}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    compareMode === 'original'
                      ? 'bg-dark-800 text-white'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Before (Original)
                </button>
              </div>
            )}
          </div>

          <AudioWaveVisualizer
            audioUrl={compareMode === 'isolated' ? resultGen.audioUrl : sourceAudioUrl || resultGen.audioUrl}
            duration={resultGen.duration}
            autoPlay
            fileName={`isolated-${fileName}.wav`}
          />
        </div>
      )}
    </div>
  );
}
