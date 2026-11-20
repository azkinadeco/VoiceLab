'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Voice } from '@/lib/types';
import { ACCENT_CATEGORIES } from '@/lib/voices-data';
import { Search, Volume2, Check, X, Loader2, Star, Pause } from 'lucide-react';
import { getFavoriteVoiceIds, toggleFavoriteVoice, onVoicePrefsChange } from '@/lib/voice-prefs';
import { haptic } from '@/lib/haptics';

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
  const [favIds, setFavIds] = useState<string[]>([]);

  useEffect(() => {
    setFavIds(getFavoriteVoiceIds());
    return onVoicePrefsChange(() => setFavIds(getFavoriteVoiceIds()));
  }, []);

  // Stop any preview when the sheet closes
  useEffect(() => {
    if (!isOpen) {
      audioRef.current?.pause();
      setPreviewingVoiceId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredVoices = voices.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(query.toLowerCase()) ||
      v.accent.toLowerCase().includes(query.toLowerCase()) ||
      v.description.toLowerCase().includes(query.toLowerCase());

    let matchAccent = true;
    if (selectedAccent === 'favorites') {
      matchAccent = favIds.includes(v.id);
    } else if (selectedAccent !== 'all') {
      if (selectedAccent === 'European') {
        matchAccent = ['Spanish', 'French', 'German'].includes(v.accent);
      } else {
        matchAccent = v.accent === selectedAccent;
      }
    }

    return matchSearch && matchAccent;
  }).sort((a, b) => Number(favIds.includes(b.id)) - Number(favIds.includes(a.id)));

  const accentChips = [
    ACCENT_CATEGORIES[0],
    { id: 'favorites', label: `Favorit${favIds.length ? ` (${favIds.length})` : ''}`, flag: '⭐' },
    ...ACCENT_CATEGORIES.slice(1),
  ];

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
        style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}
        className={`w-full max-w-lg sheet-slide-up flex flex-col h-[86vh] max-h-[calc(100dvh-var(--sat)-12px)] overflow-hidden ${
          isAndroid
            ? 'rounded-t-[28px] bg-[#161a22] border-t border-white/10'
            : 'rounded-t-[32px] bg-dark-900/95 backdrop-blur-2xl border-t border-white/15'
        } px-4 pt-3 gap-3`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Handle Pill */}
        <div className="flex justify-center shrink-0">
          <div className="h-[5px] w-9 rounded-full bg-white/25" />
        </div>

        {/* Header Title + Close */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-[17px] font-bold text-white tracking-tight">Pilih Suara</h3>
            <p className="text-[12px] text-dark-400">Suara vokal neural untuk naskah video Anda</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-dark-300 hover:text-white"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="text"
            placeholder="Cari suara (Gadis, Ardi, Jawa, Sunda)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl bg-dark-950/80 border border-white/10 pl-10 pr-4 h-11 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Horizontal Accent Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar fade-x -mx-4 px-4 py-0.5 shrink-0">
          {accentChips.map((acc) => {
            const isSelected = selectedAccent === acc.id;
            return (
              <button
                key={acc.id}
                onClick={() => setSelectedAccent(acc.id)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all shrink-0 ${
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
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 no-scrollbar overscroll-contain">
          {filteredVoices.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-[13px] text-dark-400">
              {selectedAccent === 'favorites'
                ? 'Belum ada favorit. Ketuk ☆ di samping suara untuk menyimpannya.'
                : 'Suara tidak ditemukan.'}
            </div>
          )}
          {filteredVoices.map((voice) => {
            const isSelected = voice.id === selectedVoiceId;
            const isPlaying = previewingVoiceId === voice.id;
            const isFav = favIds.includes(voice.id);

            return (
              <div
                key={voice.id}
                onClick={() => {
                  onSelectVoice(voice);
                  onClose();
                }}
                className={`flex items-center justify-between gap-2 p-3 rounded-2xl cursor-pointer border transition-all active:scale-[0.99] ${
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
                    className="h-11 w-11 rounded-full object-cover border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-white truncate">{voice.name}</span>
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
                    <p className="text-[12px] text-dark-400 truncate mt-0.5">
                      {voice.accent} • {voice.gender === 'male' ? 'Pria' : 'Wanita'} •{' '}
                      {voice.labels?.useCase || 'Voiceover'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic(8);
                    toggleFavoriteVoice(voice.id);
                  }}
                  aria-label={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                  className="flex h-10 w-9 items-center justify-center"
                >
                  <Star className={`h-[18px] w-[18px] ${isFav ? 'fill-amber-400 text-amber-400' : 'text-dark-500'}`} />
                </button>
                <button
                  onClick={(e) => handlePlayPreview(voice, e)}
                  aria-label="Dengarkan sampel suara"
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all shrink-0 ${
                    isPlaying
                      ? 'bg-brand-500 border-brand-400 text-white animate-pulse'
                      : 'bg-white/[0.06] border-white/10 text-dark-300 hover:text-white'
                  }`}
                  title="Dengarkan sampel suara"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-brand-400" />
                  )}
                </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
