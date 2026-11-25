'use client';

import React, { useState, useRef } from 'react';
import PageHeader from './PageHeader';
import { toast } from '@/lib/toast';
import { haptic } from '@/lib/haptics';
import { Generation } from '@/lib/types';
import {
  Search,
  Star,
  Trash2,
  Download,
  RefreshCw,
  RotateCcw,
  FileText,
  Share2,
  Play,
  Pause,
  ChevronDown,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';

interface HistoryPanelProps {
  generations: Generation[];
  onDeleteGeneration: (id: string) => void;
  onToggleStar: (id: string) => void;
  onRefresh: () => void;
  onReuseGeneration?: (gen: Generation) => void;
  onOpenTrimmer?: (url: string, duration: number, fileName?: string) => void;
}

export default function HistoryPanel({
  generations,
  onDeleteGeneration,
  onToggleStar,
  onRefresh,
  onReuseGeneration,
  onOpenTrimmer,
}: HistoryPanelProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tts' | 'speech-to-speech' | 'sfx' | 'isolated' | 'starred'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const quickAudioRef = useRef<HTMLAudioElement | null>(null);

  const filtered = generations.filter((gen) => {
    const matchSearch =
      gen.text.toLowerCase().includes(search.toLowerCase()) ||
      gen.voiceName.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterType === 'starred') return gen.starred;
    if (filterType === 'tts') return gen.type === 'tts' || !gen.type;
    if (filterType === 'speech-to-speech') return gen.type === 'speech-to-speech';
    if (filterType === 'sfx') return gen.type === 'sfx';
    if (filterType === 'isolated') return gen.type === 'isolated';
    return true;
  });

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const extOf = (url: string) => (url.endsWith('.wav') || url.startsWith('data:audio/wav') ? 'wav' : 'mp3');

  const toggleQuickPlay = (gen: Generation, e: React.MouseEvent) => {
    e.stopPropagation();
    haptic(6);
    if (playingId === gen.id) {
      quickAudioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (quickAudioRef.current) {
      quickAudioRef.current.pause();
    }
    const audio = new Audio(gen.audioUrl);
    quickAudioRef.current = audio;
    setPlayingId(gen.id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      toast('Gagal memutar audio', 'error');
    };
    audio.play().catch(() => setPlayingId(null));
  };

  // Group by recency
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const groupOf = (iso: string) => {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return 'Lebih lama';
    if (t >= startOfToday.getTime()) return 'Hari ini';
    if (t >= startOfToday.getTime() - dayMs) return 'Kemarin';
    if (t >= startOfToday.getTime() - 6 * dayMs) return '7 hari terakhir';
    return 'Lebih lama';
  };
  const groups: { label: string; items: Generation[] }[] = [];
  filtered.forEach((g) => {
    const label = groupOf(g.createdAt);
    const existing = groups.find((x) => x.label === label);
    if (existing) existing.items.push(g);
    else groups.push({ label, items: [g] });
  });

  const downloadSrt = (gen: Generation) => {
    const blob = new Blob([gen.srtSubtitle!], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gen.voiceName}-${gen.id}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Subtitle .SRT diunduh');
  };

  const shareGen = (gen: Generation) => {
    const url = gen.audioUrl.startsWith('data:') ? window.location.origin : window.location.origin + gen.audioUrl;
    if ('share' in navigator) {
      navigator.share({ title: `Voiceover ${gen.voiceName}`, text: gen.text, url }).catch(() => {});
    } else {
      (window.navigator as Navigator).clipboard?.writeText(url);
      toast('Link disalin');
    }
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId !== id) {
      haptic(15);
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setConfirmDeleteId(null);
    if (playingId === id) {
      quickAudioRef.current?.pause();
      setPlayingId(null);
    }
    onDeleteGeneration(id);
    toast('Audio dihapus', 'info');
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto overflow-x-hidden">
      <PageHeader
        title="Riwayat & Generasi"
        mobileTitle="Riwayat"
        titleAddon={
          <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[12px] font-semibold text-dark-200">
            {generations.length}
          </span>
        }
        subtitle="Semua audio tersimpan lokal."
      />

      {/* Compact Search + Refresh row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="search"
            placeholder="Cari audio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl bg-white/[0.05] pl-9 pr-3 text-[14px] text-white placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={() => {
            haptic(6);
            onRefresh();
            toast('Diperbarui', 'info');
          }}
          aria-label="Muat ulang"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-dark-300 hover:text-white active:scale-95 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filter pills — contained cleanly without negative margins causing overflowX */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(
          [
            { id: 'all', label: 'Semua' },
            { id: 'tts', label: 'Suara' },
            { id: 'speech-to-speech', label: 'Ubah' },
            { id: 'sfx', label: 'SFX' },
            { id: 'isolated', label: 'Isolasi' },
            { id: 'starred', label: '⭐ Favorit' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => {
              haptic(5);
              setFilterType(f.id);
            }}
            className={`shrink-0 h-9 rounded-full px-3.5 text-[12.5px] font-medium transition-all active:scale-95 ${
              filterType === f.id
                ? 'bg-white text-black font-semibold'
                : 'bg-white/[0.05] text-dark-300 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] px-6 py-12 text-center">
          <div className="text-2xl">🎧</div>
          <p className="mt-2 text-[14px] font-semibold text-white">
            {generations.length === 0 ? 'Belum ada audio' : 'Tidak ditemukan'}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-1.5">
            <h2 className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-dark-500">
              {group.label} · {group.items.length}
            </h2>
            <div className="rounded-2xl bg-[#141418] divide-y divide-white/[0.06] overflow-hidden">
              {group.items.map((gen) => {
                const isOpen = openId === gen.id;
                const isPlaying = playingId === gen.id;
                const canReuse = onReuseGeneration && (gen.type === 'tts' || !gen.type);
                const ext = extOf(gen.audioUrl);

                return (
                  <div key={gen.id} className="transition-colors">
                    {/* Compact 1-row item (~68px) */}
                    <div
                      onClick={() => {
                        haptic(5);
                        if (isPlaying) {
                          quickAudioRef.current?.pause();
                          setPlayingId(null);
                        }
                        setOpenId(isOpen ? null : gen.id);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer active:bg-white/[0.04] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleQuickPlay(gen, e)}
                        aria-label={isPlaying ? 'Jeda' : 'Putar'}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${
                          isPlaying
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                            : 'bg-white/[0.07] text-white hover:bg-white/[0.14]'
                        }`}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4 fill-white" />
                        ) : (
                          <Play className="h-4 w-4 fill-white translate-x-[1px]" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold text-white">
                            {gen.voiceName}
                          </span>
                          <span className="shrink-0 text-[11px] font-mono text-dark-400">
                            {gen.duration}s
                          </span>
                        </div>
                        <p className="truncate text-[12px] text-dark-400">{gen.text}</p>
                      </div>

                      <a
                        href={gen.audioUrl}
                        download={`${gen.voiceName}-${gen.id}.${ext}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toast(`Mengunduh ${ext.toUpperCase()}…`, 'info');
                        }}
                        aria-label="Unduh"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dark-300 hover:bg-white/[0.08] hover:text-white active:scale-90"
                      >
                        <Download className="h-4 w-4" />
                      </a>

                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-dark-500 transition-transform ${
                          isOpen ? 'rotate-180 text-white' : ''
                        }`}
                      />
                    </div>

                    {/* Expanded details & controls (only rendered when tapped!) */}
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-2.5 bg-black/25 animate-fadeIn">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12.5px] leading-relaxed text-dark-200">{gen.text}</p>
                          <button
                            onClick={() => {
                              haptic(8);
                              onToggleStar(gen.id);
                            }}
                            aria-label={gen.starred ? 'Hapus favorit' : 'Tandai favorit'}
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              gen.starred ? 'text-amber-400' : 'text-dark-500'
                            }`}
                          >
                            <Star className={`h-4 w-4 ${gen.starred ? 'fill-amber-400' : ''}`} />
                          </button>
                        </div>

                        <div className="text-[11px] text-dark-500">
                          {formatDate(gen.createdAt)} · {gen.model}
                        </div>

                        <AudioWaveVisualizer
                          audioUrl={gen.audioUrl}
                          duration={gen.duration}
                          compact
                          fileName={`${gen.voiceName}-${gen.id}.${ext}`}
                          onOpenTrimmer={
                            onOpenTrimmer
                              ? (url, dur) => onOpenTrimmer(url, dur, `${gen.voiceName}-${gen.id}.${ext}`)
                              : undefined
                          }
                        />

                        <div className="flex items-center gap-1.5">
                          {canReuse && (
                            <button
                              onClick={() => onReuseGeneration!(gen)}
                              className="flex-1 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-500/20 text-[12.5px] font-semibold text-brand-200 active:scale-95"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Pakai Lagi
                            </button>
                          )}
                          {gen.srtSubtitle && (
                            <button
                              onClick={() => downloadSrt(gen)}
                              className="flex h-10 px-3 items-center justify-center gap-1 rounded-xl bg-white/[0.06] text-[12px] font-semibold text-amber-300 active:scale-95"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              SRT
                            </button>
                          )}
                          <button
                            onClick={() => shareGen(gen)}
                            aria-label="Bagikan"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-dark-200 active:scale-95"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(gen.id)}
                            aria-label="Hapus"
                            className={`flex h-10 px-3 shrink-0 items-center justify-center gap-1 rounded-xl text-[12px] font-semibold active:scale-95 transition-colors ${
                              confirmDeleteId === gen.id
                                ? 'bg-rose-500 text-white'
                                : 'bg-white/[0.05] text-rose-400'
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {confirmDeleteId === gen.id ? 'Yakin?' : ''}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
