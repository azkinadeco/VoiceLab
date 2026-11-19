'use client';

import React, { useState, useRef } from 'react';
import { Voice } from '@/lib/types';
import { ACCENT_CATEGORIES } from '@/lib/voices-data';
import { Search, Volume2, Check, X, Loader2 } from 'lucide-react';

interface MobileVoiceSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: Voice[];
  selectedVoiceId: string;
  onSelectVoice: (voice: Voice) => void;
  platform?: 'ios' | 'android';
}

export default function MobileVoiceSheetModal({
  isOpen,
  onClose,
  voices,
  selectedVoiceId,
  onSelectVoice,
  platform = 'ios',
}: MobileVoiceSheetModalProps) {
  const [query, setQuery] = useState('');
  const [selectedAccent, setSelectedAccent] = useState<string>('all');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const filteredVoices = voices.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(query.toLowerCase()) ||
      v.accent.toLowerCase().includes(query.toLowerCase()) ||
      v.description.toLowerCase().includes(query.toLowerCase());

    let matchAccent = true;
    if (selectedAccent !== 'all') {
      if (selectedAccent === 'European') {
        matchAccent = ['Spanish', 'French', 'German'].includes(v.accent);
      } else {
        matchAccent = v.accent === selectedAccent;
      }
    }

    return matchSearch && matchAccent;
  });

  const handlePlayPreview = async (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPreviewingVoiceId(null);
      return;
    }

    setPreviewingVoiceId(voice.id);
    try {
      if (voice.previewUrl) {
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(voice.previewUrl);
        audioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        await audio.play();
        return;
      }

      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id }),
      });
      if (!res.ok) throw new Error('Preview error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPreviewingVoiceId(null);
    }
  };

  const isAndroid = platform === 'android';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg sheet-slide-up flex flex-col max-h-[82vh] overflow-hidden ${
          isAndroid
            ? 'rounded-t-[28px] bg-[#161a22] border-t border-white/10'
            : 'rounded-t-[32px] bg-dark-900/95 backdrop-blur-2xl border-t border-white/15'
        } p-4 space-y-3.5`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Handle Pill */}
        <div className="flex justify-center -mt-1 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-white/25" />
        </div>

        {/* Header Title + Close */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Pilih Karakter Suara</h3>
            <p className="text-[11px] text-dark-400">Suara vokal neural untuk naskah video Anda</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-dark-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dark-400" />
          <input
            type="text"
            placeholder="Cari suara (Gadis, Ardi, Jawa, Sunda)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full bg-dark-950/80 border border-white/10 pl-8 pr-4 py-2 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Horizontal Accent Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {ACCENT_CATEGORIES.map((acc) => {
            const isSelected = selectedAccent === acc.id;
            return (
              <button
                key={acc.id}
                onClick={() => setSelectedAccent(acc.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all shrink-0 ${
                  isSelected
                    ? isAndroid
                      ? 'bg-purple-500 text-black'
                      : 'bg-white text-black shadow-sm'
                    : 'bg-white/[0.05] text-dark-300 hover:text-white'
                }`}
              >
                {acc.flag} {acc.label.replace('English ', '').replace(' (Nasional)', '')}
              </button>
            );
          })}
        </div>

        {/* Voice Cards List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 no-scrollbar max-h-[50vh]">
          {filteredVoices.map((voice) => {
            const isSelected = voice.id === selectedVoiceId;
            const isPlaying = previewingVoiceId === voice.id;

            return (
              <div
                key={voice.id}
                onClick={() => {
                  onSelectVoice(voice);
                  onClose();
                }}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                  isSelected
                    ? isAndroid
                      ? 'bg-purple-950/40 border-purple-400/80 shadow-md'
                      : 'bg-brand-950/50 border-brand-400 shadow-md'
                    : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={voice.avatarUrl}
                    alt={voice.name}
                    className="h-10 w-10 rounded-full object-cover border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{voice.name}</span>
                      {isSelected && (
                        <span
                          className={`rounded-full p-0.5 text-black ${
                            isAndroid ? 'bg-purple-400' : 'bg-white'
                          }`}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-dark-400 truncate mt-0.5">
                      {voice.accent} • {voice.gender === 'male' ? 'Pria' : 'Wanita'} •{' '}
                      {voice.labels?.useCase || 'Voiceover'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => handlePlayPreview(voice, e)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all shrink-0 ml-2 ${
                    isPlaying
                      ? 'bg-brand-500 border-brand-400 text-white animate-pulse'
                      : 'bg-white/[0.06] border-white/10 text-dark-300 hover:text-white'
                  }`}
                  title="Dengarkan sampel suara"
                >
                  {isPlaying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-brand-400" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
