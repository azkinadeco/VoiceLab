'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Activity,
  Scissors,
  SlidersHorizontal,
} from 'lucide-react';
import { decodeRealWaveformPeaks } from '@/lib/audio-dsp';

export type VisualizerMode = 'bars' | 'sine' | 'orb';

interface AudioWaveVisualizerProps {
  audioUrl: string;
  duration?: number;
  autoPlay?: boolean;
  onEnded?: () => void;
  fileName?: string;
  compact?: boolean;
  onOpenTrimmer?: (url: string, duration: number) => void;
}

export default function AudioWaveVisualizer({
  audioUrl,
  duration = 0,
  autoPlay = false,
  onEnded,
  fileName = 'generation.mp3',
  compact = false,
  onOpenTrimmer,
}: AudioWaveVisualizerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const [vizMode, setVizMode] = useState<VisualizerMode>('bars');

  // Load saved viz mode from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem('voicelab_viz_mode') as VisualizerMode;
    if (saved && ['bars', 'sine', 'orb'].includes(saved)) {
      setVizMode(saved);
    }
  }, []);

  const handleCycleVizMode = () => {
    const modes: VisualizerMode[] = ['bars', 'sine', 'orb'];
    const next = modes[(modes.indexOf(vizMode) + 1) % modes.length];
    setVizMode(next);
    localStorage.setItem('voicelab_viz_mode', next);
  };

  useEffect(() => {
    let cancelled = false;
    const barsCount = compact ? 38 : 64;

    // Initial seed waveform while decoding real audio buffer
    let seed = 0;
    for (let i = 0; i < audioUrl.length; i++) {
      seed = (seed * 31 + audioUrl.charCodeAt(i)) & 0xffffffff;
    }
    const fallbackBars: number[] = [];
    for (let i = 0; i < barsCount; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const normalized = (seed % 100) / 100;
      const envelope = Math.sin((i / barsCount) * Math.PI);
      const val = Math.max(0.16, Math.min(0.95, (0.3 + 0.7 * normalized) * (0.4 + 0.6 * envelope)));
      fallbackBars.push(val);
    }
    setWaveformBars(fallbackBars);

    // Decode true acoustic peaks from audio buffer
    decodeRealWaveformPeaks(audioUrl, barsCount).then((realPeaks) => {
      if (!cancelled && realPeaks && realPeaks.length > 0) {
        setWaveformBars(realPeaks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [audioUrl, compact]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEnded) onEnded();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, autoPlay, onEnded]);

  // Canvas animations for 'sine' and 'orb' modes
  useEffect(() => {
    if (vizMode === 'bars') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (vizMode === 'sine') {
        // Multi-frequency smooth neon sine wave
        const midY = height / 2;
        const amplitude = isPlaying ? (height / 2.6) : (height / 4.5);
        const speed = isPlaying ? 0.08 : 0.02;
        phase += speed;

        // Glow layer
        ctx.save();
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const normX = x / width;
          const y =
            midY +
            Math.sin(normX * 12 + phase) * amplitude * Math.sin(normX * Math.PI) * 0.7 +
            Math.cos(normX * 24 - phase * 1.5) * (amplitude * 0.3) * Math.sin(normX * Math.PI);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#818cf8';
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Passed fill overlay
        ctx.lineTo(width * progress, midY);
        ctx.lineTo(0, midY);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, width * progress, 0);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
        grad.addColorStop(1, 'rgba(168, 85, 247, 0.4)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      } else if (vizMode === 'orb') {
        // ElevenLabs pulsating radial orb waveform
        phase += isPlaying ? 0.05 : 0.01;
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(centerX, centerY) * 0.65;
        const pulse = Math.sin(phase) * (isPlaying ? 4 : 1.5);

        ctx.save();
        ctx.beginPath();
        const points = 32;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const waveOffset = Math.sin(angle * 6 + phase * 2) * (isPlaying ? 3.5 : 1);
          const r = baseRadius + pulse + waveOffset;
          const px = centerX + Math.cos(angle) * r;
          const py = centerY + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, baseRadius * 1.3);
        grad.addColorStop(0, isPlaying ? '#a855f7' : '#6366f1');
        grad.addColorStop(0.7, isPlaying ? '#4f46e5' : '#312e81');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = isPlaying ? '#c084fc' : '#818cf8';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 14;
        ctx.stroke();

        // Progress arc ring around orb
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [vizMode, isPlaying, currentTime, totalDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const cycleRate = () => {
    const rates = [1.0, 1.25, 1.5, 0.85];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * (totalDuration || 1);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl bg-dark-950/90 border border-white/10 p-3 ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/25 transition-transform hover:scale-105 active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-white" />
          ) : (
            <Play className="h-4 w-4 fill-white translate-x-0.5" />
          )}
        </button>

        {/* Dynamic Visualizer Stage with Accessibility Keyboard Scrubbing */}
        <div
          onClick={handleSeek}
          onKeyDown={(e) => {
            const audio = audioRef.current;
            if (!audio) return;
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              const nextTime = Math.min(totalDuration, audio.currentTime + 3);
              audio.currentTime = nextTime;
              setCurrentTime(nextTime);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              const prevTime = Math.max(0, audio.currentTime - 3);
              audio.currentTime = prevTime;
              setCurrentTime(prevTime);
            } else if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              togglePlay();
            }
          }}
          tabIndex={0}
          role="slider"
          aria-label="Seekbar Audio Visualizer"
          aria-valuenow={Math.round(currentTime)}
          aria-valuemin={0}
          aria-valuemax={Math.round(totalDuration)}
          className="group relative flex h-10 min-w-0 flex-1 basis-[calc(100%-52px)] sm:basis-auto cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-dark-900/80 px-2.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
          title="Klik atau gunakan tombol panah kiri/kanan untuk menggeser waktu putar"
        >
          {vizMode === 'bars' ? (
            <div className="flex h-full w-full items-center gap-[2px] sm:gap-[3px]">
              {waveformBars.map((height, idx) => {
                const barRatio = idx / waveformBars.length;
                const isPassed = barRatio <= progress;
                return (
                  <div
                    key={idx}
                    className="flex-1 rounded-full transition-all duration-75 group-hover:opacity-90"
                    style={{
                      height: `${Math.max(6, Math.round(height * 32))}px`,
                      backgroundColor: isPassed ? '#6366f1' : '#262f46',
                      boxShadow:
                        isPassed && isPlaying ? '0 0 8px rgba(99, 102, 241, 0.65)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={340}
              height={40}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <div className="pl-[52px] sm:pl-0 sm:text-right text-xs font-mono text-dark-300 shrink-0 sm:min-w-[68px]">
          <span className="text-white font-semibold">{formatTime(currentTime)}</span>
          <span className="text-dark-400"> / {formatTime(totalDuration)}</span>
        </div>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {/* Visualizer Mode Switcher */}
          <button
            onClick={handleCycleVizMode}
            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
            title={`Mode Visualizer: ${vizMode.toUpperCase()} (Klik untuk ganti Bar / Neon Sine / Orb)`}
          >
            <Activity className="h-3.5 w-3.5" />
          </button>

          {/* Speed Rate */}
          <button
            onClick={cycleRate}
            className="h-9 sm:h-auto rounded-lg bg-dark-850 border border-white/10 px-2.5 sm:px-2 sm:py-1 text-xs sm:text-[11px] font-mono font-semibold text-brand-300 hover:text-white"
            title="Kecepatan Putar"
          >
            {playbackRate}x
          </button>

          {/* Trimmer Trigger if provided */}
          {onOpenTrimmer && (
            <button
              onClick={() => onOpenTrimmer(audioUrl, totalDuration)}
              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
              title="Potong Audio (Trim & Clip Silence)"
            >
              <Scissors className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Mute */}
          <button
            onClick={toggleMute}
            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          {/* Download */}
          <a
            href={audioUrl}
            download={fileName}
            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
            title="Download Audio"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
