'use client';

import React, { useState, useRef } from 'react';
import { Voice } from '@/lib/types';
import { ACCENT_CATEGORIES } from '@/lib/voices-data';
import { X, Search, Volume2, Check, UserPlus, Loader2 } from 'lucide-react';

interface VoiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: Voice[];
  selectedVoiceId: string;
  onSelectVoice: (voice: Voice) => void;
  onOpenVoiceLab: () => void;
}

export default function VoiceSelectorModal({
  isOpen,
  onClose,
  voices,
  selectedVoiceId,
  onSelectVoice,
  onOpenVoiceLab,
}: VoiceSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccent, setSelectedAccent] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const filteredVoices = voices.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.accent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.language.toLowerCase().includes(searchQuery.toLowerCase());

    let matchAccent = true;
    if (selectedAccent !== 'all') {
      if (selectedAccent === 'European') {
        matchAccent = ['Spanish', 'French', 'German'].includes(v.accent);
      } else if (selectedAccent === 'cloned') {
        matchAccent = v.category === 'cloned' || v.category === 'designed';
      } else {
        matchAccent = v.accent === selectedAccent;
      }
    }

    let matchGender = true;
    if (genderFilter !== 'all') matchGender = v.gender === genderFilter;

    return matchSearch && matchAccent && matchGender;
  });

  const playNeuralPreview = async (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voice.id);

    try {
      if (voice.previewUrl) {
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(voice.previewUrl);
        audioRef.current = audio;
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
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
        setPlayingVoiceId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setPlayingVoiceId(null);
      await audio.play();
    } catch {
      setPlayingVoiceId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl bg-dark-900 border border-white/15 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-dark-950/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              Voice & Accent Library
              <span className="rounded-full bg-brand-500/20 border border-brand-500/30 px-2.5 py-0.5 text-xs font-semibold text-brand-300">
                {voices.length} Suara Neural
              </span>
            </h2>
            <p className="text-xs text-dark-300 mt-0.5">
              Pilih aksen bahasa dan klik tombol Sample untuk mendengarkan logat asli suara neural
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                onClose();
                onOpenVoiceLab();
              }}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-500 transition-colors shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              Clone Suara Sendiri
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search & Accent Filter Bar */}
        <div className="border-b border-white/10 px-6 py-3.5 bg-dark-950/30 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
              <input
                type="text"
                placeholder="Cari nama suara, aksen (Jawa, Sunda, British, Jepang, Arab), atau fungsi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder-dark-400 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="rounded-xl bg-dark-850 border border-white/10 px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-brand-500 shrink-0"
            >
              <option value="all">Semua Gender</option>
              <option value="male">Pria (Male)</option>
              <option value="female">Wanita (Female)</option>
            </select>
          </div>

          {/* All Accent Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {ACCENT_CATEGORIES.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccent(acc.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0 border ${
                  selectedAccent === acc.id
                    ? 'bg-brand-600 text-white border-brand-400 shadow-sm'
                    : 'bg-dark-850 text-dark-300 border-white/10 hover:bg-dark-800 hover:text-white'
                }`}
              >
                <span>{acc.flag}</span>
                <span>{acc.label}</span>
              </button>
            ))}
            <button
              onClick={() => setSelectedAccent('cloned')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0 border ${
                selectedAccent === 'cloned'
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                  : 'bg-dark-850 text-dark-300 border-white/10 hover:bg-dark-800 hover:text-white'
              }`}
            >
              🧬 My Cloned Voices
            </button>
          </div>
        </div>

        {/* Voices Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVoices.map((voice) => {
            const isSelected = voice.id === selectedVoiceId;
            const isPlaying = playingVoiceId === voice.id;

            return (
              <div
                key={voice.id}
                onClick={() => {
                  onSelectVoice(voice);
                  onClose();
                }}
                className={`group relative flex flex-col justify-between rounded-2xl p-4 cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-brand-950/50 border-brand-400 shadow-lg shadow-brand-500/15'
                    : 'bg-dark-850/80 border-white/10 hover:border-white/25 hover:bg-dark-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={voice.avatarUrl}
                        alt={voice.name}
                        className="h-12 w-12 rounded-full object-cover border border-white/20 shadow-md"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-white">{voice.name}</h4>
                          {isSelected && (
                            <span className="rounded-full bg-brand-500 p-0.5 text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-brand-300 mt-0.5">
                          Aksen: {voice.accent} • {voice.gender === 'male' ? 'Pria' : 'Wanita'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => playNeuralPreview(voice, e)}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                        isPlaying
                          ? 'bg-brand-500 border-brand-300 text-white animate-pulse'
                          : 'bg-dark-900 border-white/15 text-dark-200 hover:bg-dark-750 hover:text-white'
                      }`}
                      title="Dengarkan sample suara neural asli"
                    >
                      {isPlaying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5 text-brand-400" />
                      )}
                      <span>Sample</span>
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-dark-200 line-clamp-2 leading-relaxed">
                    {voice.description}
                  </p>
                </div>

                <div className="mt-3.5 flex flex-wrap gap-1.5 pt-2.5 border-t border-white/10">
                  <span className="rounded-md bg-brand-500/20 border border-brand-500/30 px-2 py-0.5 text-[11px] font-semibold text-brand-200">
                    {voice.accent}
                  </span>
                  {voice.labels?.useCase && (
                    <span className="rounded-md bg-dark-750 px-2 py-0.5 text-[11px] text-dark-200">
                      {voice.labels.useCase}
                    </span>
                  )}
                  {voice.labels?.tone && (
                    <span className="rounded-md bg-dark-750 px-2 py-0.5 text-[11px] text-dark-300">
                      {voice.labels.tone}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredVoices.length === 0 && (
            <div className="col-span-full py-12 text-center text-dark-300 text-sm">
              Tidak ada suara yang cocok dengan filter aksen atau pencarian ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
