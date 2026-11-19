'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Generation } from '@/lib/types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  X,
} from 'lucide-react';

interface GlobalAudioPlayerProps {
  activeTrack: Generation | null;
  playlist: Generation[];
  onSelectTrack: (track: Generation) => void;
  onClose: () => void;
  autoPlayOnLoad?: boolean;
  insideIphoneFrame?: boolean;
}

export default function GlobalAudioPlayer({
  activeTrack,
  playlist,
  onSelectTrack,
  onClose,
  autoPlayOnLoad = false,
  insideIphoneFrame = false,
}: GlobalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack) return;

    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(activeTrack.duration || 0);
    audio.src = activeTrack.audioUrl;
    audio.playbackRate = playbackRate;

    if (autoPlayOnLoad) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [activeTrack?.id, autoPlayOnLoad]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      } else if (activeTrack?.duration) {
        setDuration(activeTrack.duration);
      }
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, [activeTrack]);

  if (!activeTrack) return null;

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

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const currentIndex = playlist.findIndex((g) => g.id === activeTrack.id);
  const handlePrev = () => {
    if (currentIndex > 0) onSelectTrack(playlist[currentIndex - 1]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
      onSelectTrack(playlist[currentIndex + 1]);
    }
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`${
        insideIphoneFrame
          ? 'mx-3 mb-2'
          : 'fixed bottom-16 lg:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl'
      }`}
    >
      <audio ref={audioRef} preload="metadata" />

      <div className="relative overflow-hidden rounded-full bg-dark-900/95 backdrop-blur-2xl border border-white/15 px-3.5 py-2 shadow-2xl">
        {/* Subtle bottom progress line */}
        <div
          className="absolute bottom-0 left-0 h-[2px] bg-white transition-all duration-75"
          style={{ width: `${progressPct}%` }}
        />

        <div className="flex items-center justify-between gap-3">
          {/* Left: Orb + Title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img
              src={activeTrack.voiceAvatar}
              alt={activeTrack.voiceName}
              className="h-8 w-8 rounded-full object-cover shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {activeTrack.voiceName}
              </div>
              <p className="text-[11px] text-dark-400 truncate">{activeTrack.text}</p>
            </div>
          </div>

          {/* Center: Play/Pause + Prev/Next */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-1 text-dark-400 hover:text-white disabled:opacity-25"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={togglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow hover:bg-zinc-200 transition-transform active:scale-95"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-black" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-black translate-x-0.5" />
              )}
            </button>

            <button
              onClick={handleNext}
              disabled={currentIndex < 0 || currentIndex >= playlist.length - 1}
              className="p-1 text-dark-400 hover:text-white disabled:opacity-25"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Right: Speed + Download + Close */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={cycleSpeed}
              className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono font-semibold text-dark-200 hover:text-white"
            >
              {playbackRate}x
            </button>

            <a
              href={activeTrack.audioUrl}
              download={`${activeTrack.voiceName}-${activeTrack.id}.mp3`}
              className="p-1.5 text-dark-300 hover:text-white"
              title="Download MP3"
            >
              <Download className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-1 text-dark-400 hover:text-rose-400"
              title="Tutup"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
