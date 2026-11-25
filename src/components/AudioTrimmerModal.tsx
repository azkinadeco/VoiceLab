'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Volume2,
  Loader2,
} from 'lucide-react';
import {
  decodeRealWaveformPeaks,
  detectSilenceAndTrim,
  sliceAudioBlob,
  blobToBase64,
} from '@/lib/audio-dsp';
import confetti from 'canvas-confetti';
import { toast } from '@/lib/toast';

interface AudioTrimmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioUrl: string | null;
  duration?: number;
  fileName?: string;
  onTrimSaved?: (trimmedUrl: string, newDuration: number) => void;
}

export default function AudioTrimmerModal({
  isOpen,
  onClose,
  audioUrl,
  duration = 0,
  fileName = 'audio.mp3',
  onTrimSaved,
}: AudioTrimmerModalProps) {
  const [totalDuration, setTotalDuration] = useState(duration);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration || 5);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAutoClipping, setIsAutoClipping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !audioUrl) return;

    setStartTime(0);
    setEndTime(duration || 5);
    setCurrentTime(0);
    setIsPlaying(false);
    setNotice(null);

    // Decode waveform
    decodeRealWaveformPeaks(audioUrl, 64).then((peaks) => {
      if (peaks) setWaveformBars(peaks);
    });

    // Load actual audio duration
    const audio = new Audio(audioUrl);
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
        setEndTime(audio.duration);
      }
    };
  }, [isOpen, audioUrl, duration]);

  // Audio playback tracking within trim window
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= endTime) {
        audio.pause();
        audio.currentTime = startTime;
        setIsPlaying(false);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = startTime;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [startTime, endTime]);

  const togglePlaySegment = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.currentTime < startTime || audio.currentTime >= endTime) {
        audio.currentTime = startTime;
      }
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleAutoClipSilence = async () => {
    if (!audioUrl) return;
    setIsAutoClipping(true);
    setNotice(null);
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const result = await detectSilenceAndTrim(blob, -42);
      setStartTime(result.startSec);
      setEndTime(result.endSec);
      setNotice(
        `Sunyi terpotong: Mulai di ${result.startSec}s, Berakhir di ${result.endSec}s (${result.newDuration}s)`
      );
    } catch (e: any) {
      setNotice('Gagal mendeteksi sunyi otomatis: ' + e.message);
    } finally {
      setIsAutoClipping(false);
    }
  };

  const handleSaveTrim = async () => {
    if (!audioUrl) return;
    setIsSaving(true);
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const sliced = await sliceAudioBlob(blob, startTime, endTime);

      const base64 = await blobToBase64(sliced.wavBlob);
      const saveRes = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          category: 'generations',
          filename: `trimmed-${fileName.replace(/\.[^/.]+$/, '')}.wav`,
          type: 'tts',
          text: `Potong Audio (${startTime.toFixed(1)}s – ${endTime.toFixed(1)}s): ${fileName}`,
          voiceName: 'Audio Trimmer',
          voiceId: 'audio-trimmer',
          duration: sliced.duration,
          model: 'Local Audio Trimmer DSP',
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error);

      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });

      if (onTrimSaved) {
        onTrimSaved(saveData.url, sliced.duration);
      }
      toast('Audio berhasil dipotong & disimpan');

      onClose();
    } catch (err: any) {
      toast('Gagal menyimpan hasil potong audio: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSecs = (sec: number) => {
    const s = Math.max(0, sec);
    return `${s.toFixed(2)}s`;
  };

  if (!isOpen || !audioUrl) return null;

  const trimDuration = Math.max(0, endTime - startTime);
  const startRatio = totalDuration > 0 ? (startTime / totalDuration) * 100 : 0;
  const endRatio = totalDuration > 0 ? (endTime / totalDuration) * 100 : 100;
  const currentRatio = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div
      className="m-sheet-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="m-sheet relative flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-dark-900 border border-white/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <audio ref={audioRef} src={audioUrl} preload="auto" />

        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 mx-4 sm:mx-6 pt-3 sm:pt-6 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400">
              <Scissors className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-sm font-bold text-white">
                <span className="sm:hidden">Potong Audio</span>
                <span className="hidden sm:inline">Audio Trimmer & Silence Clipper</span>
              </h2>
              <p className="text-[11px] text-dark-400">
                Potong durasi atau bersihkan sunyi awal & akhir audio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-5">

        {/* Notice alert */}
        {notice && (
          <div className="flex items-center gap-2 rounded-xl bg-brand-500/15 border border-brand-500/30 p-2.5 text-xs text-brand-300">
            <Sparkles className="h-3.5 w-3.5 text-brand-400 shrink-0" />
            <span className="line-clamp-2 sm:truncate">{notice}</span>
          </div>
        )}

        {/* Visual Waveform + Handles */}
        <div className="space-y-2">
          <div className="relative h-20 w-full rounded-2xl bg-dark-950/90 border border-white/10 p-2 flex items-center justify-center overflow-hidden select-none">
            {/* Waveform Bars */}
            <div className="flex h-full w-full items-center gap-[2px]">
              {waveformBars.map((h, i) => {
                const barRatio = (i / waveformBars.length) * 100;
                const isInSelectedRegion = barRatio >= startRatio && barRatio <= endRatio;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(6, Math.round(h * 56))}px`,
                      backgroundColor: isInSelectedRegion ? '#6366f1' : '#272f45',
                      opacity: isInSelectedRegion ? 1 : 0.35,
                    }}
                  />
                );
              })}
            </div>

            {/* Inactive Left Mask */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none"
              style={{ width: `${startRatio}%` }}
            />
            {/* Inactive Right Mask */}
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none"
              style={{ width: `${100 - endRatio}%` }}
            />

            {/* Playhead indicator */}
            {isPlaying && (
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-lg pointer-events-none z-10"
                style={{ left: `${currentRatio}%` }}
              />
            )}
          </div>

          {/* Time markers and handles sliders */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-xs font-mono text-dark-300">
              <span className="flex items-center gap-1">
                Awal: <strong className="text-white">{formatSecs(startTime)}</strong>
              </span>
              <span className="flex items-center gap-1 font-semibold text-brand-400">
                Durasi: {formatSecs(trimDuration)}
              </span>
              <span className="flex items-center gap-1">
                Akhir: <strong className="text-white">{formatSecs(endTime)}</strong>
              </span>
            </div>

            {/* Start Slider */}
            <div className="flex h-10 sm:h-auto items-center gap-2 text-[11px] text-dark-400">
              <span className="w-12 shrink-0">Start:</span>
              <input
                type="range"
                min="0"
                max={Math.max(0.1, endTime - 0.1)}
                step="0.05"
                value={startTime}
                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* End Slider */}
            <div className="flex h-10 sm:h-auto items-center gap-2 text-[11px] text-dark-400">
              <span className="w-12 shrink-0">End:</span>
              <input
                type="range"
                min={startTime + 0.1}
                max={totalDuration || 5}
                step="0.05"
                value={endTime}
                onChange={(e) => setEndTime(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2 sm:gap-3 mx-4 sm:mx-6 pt-3 pb-4 sm:pb-6 border-t border-white/10">
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <button
              onClick={togglePlaySegment}
              className="flex h-11 sm:h-auto items-center justify-center gap-1.5 rounded-2xl sm:rounded-xl bg-dark-850 hover:bg-dark-800 border border-white/10 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 fill-white" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white translate-x-0.5" />
                  <span>Preview</span>
                </>
              )}
            </button>

            <button
              onClick={handleAutoClipSilence}
              disabled={isAutoClipping}
              className="flex h-11 sm:h-auto items-center justify-center gap-1.5 rounded-2xl sm:rounded-xl bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 px-3.5 py-2 text-xs font-semibold text-brand-300 transition-colors disabled:opacity-50"
              title="Analisis dan hapus bagian sunyi secara otomatis"
            >
              {isAutoClipping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span className="sm:hidden">Hapus Sunyi</span>
              <span className="hidden sm:inline">Hapus Sunyi Otomatis</span>
            </button>
          </div>

          <button
            onClick={handleSaveTrim}
            disabled={isSaving || trimDuration <= 0}
            className="flex w-full sm:w-auto h-12 sm:h-auto items-center justify-center gap-1.5 rounded-2xl sm:rounded-xl bg-white hover:bg-zinc-200 text-black px-4 py-2 text-sm sm:text-xs font-bold transition-all disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
            ) : (
              <Check className="h-3.5 w-3.5 text-black" />
            )}
            <span>Simpan Audio Dipotong</span>
          </button>
        </div>
      </div>
    </div>
  );
}
