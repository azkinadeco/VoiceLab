'use client';

import React, { useState } from 'react';
import { Generation } from '@/lib/types';
import { Search, Star, Trash2, Download, Calendar, HardDrive, RefreshCw, RotateCcw, FileText, Share2 } from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';

interface HistoryPanelProps {
  generations: Generation[];
  onDeleteGeneration: (id: string) => void;
  onToggleStar: (id: string) => void;
  onRefresh: () => void;
  onReuseGeneration?: (gen: Generation) => void;
}

export default function HistoryPanel({
  generations,
  onDeleteGeneration,
  onToggleStar,
  onRefresh,
  onReuseGeneration,
}: HistoryPanelProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tts' | 'sfx' | 'isolated' | 'starred'>('all');

  const filtered = generations.filter((gen) => {
    const matchSearch =
      gen.text.toLowerCase().includes(search.toLowerCase()) ||
      gen.voiceName.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (filterType === 'starred') return gen.starred;
    if (filterType === 'tts') return gen.type === 'tts' || !gen.type;
    if (filterType === 'sfx') return gen.type === 'sfx';
    if (filterType === 'isolated') return gen.type === 'isolated';

    return true;
  });

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            History & Generations
            <span className="rounded-full bg-dark-800 px-2.5 py-0.5 text-xs font-mono text-dark-300">
              {generations.length} file
            </span>
          </h1>
          <p className="text-xs text-dark-400 mt-0.5">
            Semua riwayat generasi audio tersimpan secara aman di hard drive PC lokal Anda.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg bg-dark-850 border border-white/10 px-3 py-1.5 text-xs font-medium text-dark-300 hover:text-white hover:bg-dark-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="text"
            placeholder="Cari teks transkrip atau nama suara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-dark-900 border border-white/10 pl-9 pr-4 py-2 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'tts', label: 'Speech' },
              { id: 'sfx', label: 'SFX' },
              { id: 'isolated', label: 'Isolator' },
              { id: 'starred', label: 'Favorit ⭐' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                filterType === f.id
                  ? 'bg-brand-500 text-white'
                  : 'bg-dark-900 text-dark-400 hover:text-white hover:bg-dark-850'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generation Items */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-dark-900/50 p-12 text-center">
          <p className="text-xs text-dark-400">Belum ada riwayat generasi audio yang cocok.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((gen) => (
            <div
              key={gen.id}
              className="rounded-2xl bg-dark-900 border border-white/10 p-5 space-y-3 hover:border-white/20 transition-all shadow-md group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={gen.voiceAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={gen.voiceName}
                    className="h-9 w-9 rounded-full object-cover border border-white/10 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{gen.voiceName}</span>
                      <span className="rounded bg-dark-800 px-1.5 py-0.5 text-[10px] font-mono text-dark-300">
                        {gen.model}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-dark-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(gen.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatFileSize(gen.fileSize)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {onReuseGeneration && (gen.type === 'tts' || !gen.type) && (
                    <button
                      onClick={() => onReuseGeneration(gen)}
                      className="flex items-center gap-1 rounded-lg bg-dark-850 hover:bg-dark-800 border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-brand-300 hover:text-white transition-colors"
                      title="Muat teks & setting suara ke Editor"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span className="hidden sm:inline">Gunakan Lagi</span>
                    </button>
                  )}

                  <button
                    onClick={() => onToggleStar(gen.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      gen.starred ? 'text-amber-400' : 'text-dark-500 hover:text-dark-300'
                    }`}
                    title={gen.starred ? 'Hapus favorit' : 'Tandai favorit'}
                  >
                    <Star className={`h-4 w-4 ${gen.starred ? 'fill-amber-400' : ''}`} />
                  </button>

                  {gen.srtSubtitle && (
                    <button
                      onClick={() => {
                        const blob = new Blob([gen.srtSubtitle!], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${gen.voiceName}-${gen.id}.srt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 px-2 py-1 text-[11px] font-semibold transition-colors"
                      title="Download Subtitle .SRT untuk CapCut / Premiere"
                    >
                      <FileText className="h-3 w-3" />
                      <span className="hidden sm:inline">CapCut .SRT</span>
                    </button>
                  )}

                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={() => {
                        navigator
                          .share({
                            title: `Voiceover ${gen.voiceName}`,
                            text: gen.text,
                            url: window.location.origin + gen.audioUrl,
                          })
                          .catch(() => {});
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-500/15 transition-colors"
                      title="Bagikan ke WhatsApp, CapCut, atau TikTok"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <a
                    href={gen.audioUrl}
                    download={`${gen.voiceName}-${gen.id}.mp3`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-500 hover:text-white hover:bg-dark-800 transition-colors"
                    title="Download audio"
                  >
                    <Download className="h-4 w-4" />
                  </a>

                  <button
                    onClick={() => onDeleteGeneration(gen.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Hapus generasi dari storage lokal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Transcript */}
              <p className="text-xs text-dark-200 leading-relaxed bg-dark-950/60 p-3 rounded-xl border border-white/5 font-normal">
                "{gen.text}"
              </p>

              {/* Waveform Player */}
              <AudioWaveVisualizer audioUrl={gen.audioUrl} duration={gen.duration} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
