'use client';

import React, { useState } from 'react';
import PageHeader from './PageHeader';
import { toast } from '@/lib/toast';
import { haptic } from '@/lib/haptics';
import { Generation } from '@/lib/types';
import { Search, Star, Trash2, Download, RefreshCw, RotateCcw, FileText, Share2, ChevronDown } from 'lucide-react';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  // Group by recency: Hari ini / Kemarin / 7 hari terakhir / Lebih lama
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
    const url = window.location.origin + gen.audioUrl;
    if ('share' in navigator) {
      navigator.share({ title: `Voiceover ${gen.voiceName}`, text: gen.text, url }).catch(() => {});
    } else {
      (window.navigator as Navigator).clipboard?.writeText(url);
      toast('Link audio disalin');
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
    onDeleteGeneration(id);
    toast('File dihapus dari penyimpanan', 'info');
  };

  const actionBtn =
    'flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold transition-colors active:scale-[0.97]';

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="Riwayat & Generasi"
        mobileTitle="Riwayat Audio"
        titleAddon={
          <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[12px] font-semibold text-dark-200">
            {generations.length}
          </span>
        }
        subtitle="Semua audio tersimpan di penyimpanan lokal PC Anda."
        actions={
          <button
            onClick={() => {
              onRefresh();
              toast('Riwayat diperbarui', 'info');
            }}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3.5 text-[13px] font-medium text-dark-200 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
        }
      />

      {/* Search + filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="search"
            placeholder="Cari naskah atau nama suara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl bg-dark-900 border border-white/10 pl-10 pr-4 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar fade-x -mx-4 px-4 sm:mx-0 sm:px-0">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'tts', label: 'Voiceover' },
              { id: 'speech-to-speech', label: 'Ubah Suara' },
              { id: 'sfx', label: 'SFX' },
              { id: 'isolated', label: 'Isolator' },
              { id: 'starred', label: '⭐ Favorit' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                filterType === f.id ? 'bg-white text-black font-semibold' : 'bg-white/[0.05] text-dark-300 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-dark-900/50 px-6 py-12 text-center">
          <div className="text-3xl">🎧</div>
          <p className="mt-2 text-[14px] font-semibold text-white">
            {generations.length === 0 ? 'Belum ada audio' : 'Tidak ada yang cocok'}
          </p>
          <p className="mt-1 text-[13px] text-dark-400">
            {generations.length === 0
              ? 'Buat voiceover pertama Anda di tab Voiceover.'
              : 'Coba kata kunci atau filter lain.'}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-2.5">
            <h2 className="px-1 text-[12px] font-semibold uppercase tracking-wider text-dark-400">
              {group.label} · {group.items.length}
            </h2>
            {group.items.map((gen) => {
              const expanded = expandedId === gen.id;
              const canReuse = onReuseGeneration && (gen.type === 'tts' || !gen.type);
              return (
                <div key={gen.id} className="studio-card rounded-3xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={gen.voiceAvatar}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-white">{gen.voiceName}</div>
                      <div className="truncate text-[12px] text-dark-400">
                        {formatDate(gen.createdAt)} · {gen.duration}s · {formatFileSize(gen.fileSize)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        haptic(8);
                        onToggleStar(gen.id);
                      }}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        gen.starred ? 'text-amber-400' : 'text-dark-500'
                      }`}
                      aria-label={gen.starred ? 'Hapus favorit' : 'Tandai favorit'}
                    >
                      <Star className={`h-5 w-5 ${gen.starred ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>

                  <button
                    onClick={() => setExpandedId(expanded ? null : gen.id)}
                    className="block w-full rounded-2xl bg-dark-950/60 border border-white/5 px-3.5 py-2.5 text-left"
                  >
                    <p className={`text-[13px] leading-relaxed text-dark-200 ${expanded ? '' : 'line-clamp-2'}`}>
                      {gen.text}
                    </p>
                    {gen.text.length > 90 && (
                      <span className="mt-1 flex items-center gap-0.5 text-[12px] font-medium text-dark-400">
                        {expanded ? 'Ringkas' : 'Selengkapnya'}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </span>
                    )}
                  </button>

                  <AudioWaveVisualizer
                    audioUrl={gen.audioUrl}
                    duration={gen.duration}
                    compact
                    onOpenTrimmer={
                      onOpenTrimmer
                        ? (url, dur) => onOpenTrimmer(url, dur, `${gen.voiceName}-${gen.id}.mp3`)
                        : undefined
                    }
                  />

                  <div className="grid grid-cols-5 gap-1.5">
                    <button
                      disabled={!canReuse}
                      onClick={() => canReuse && onReuseGeneration!(gen)}
                      className={`${actionBtn} col-span-2 bg-brand-500/15 border-brand-500/30 text-brand-200 disabled:opacity-30`}
                      title="Muat teks & setting suara ke Editor"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Pakai Lagi
                    </button>
                    <button
                      disabled={!gen.srtSubtitle}
                      onClick={() => downloadSrt(gen)}
                      className={`${actionBtn} bg-amber-500/10 border-amber-500/25 text-amber-200 disabled:opacity-30`}
                      aria-label="Unduh subtitle SRT"
                      title="Download Subtitle .SRT untuk CapCut / Premiere"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">SRT</span>
                    </button>
                    <button
                      onClick={() => shareGen(gen)}
                      className={`${actionBtn} bg-white/[0.04] border-white/10 text-dark-200`}
                      aria-label="Bagikan"
                      title="Bagikan ke WhatsApp, CapCut, atau TikTok"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <a
                      href={gen.audioUrl}
                      download={`${gen.voiceName}-${gen.id}.mp3`}
                      className={`${actionBtn} bg-white text-black border-white`}
                      aria-label="Unduh MP3"
                      title="Download audio"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>

                  <button
                    onClick={() => handleDelete(gen.id)}
                    className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-colors ${
                      confirmDeleteId === gen.id
                        ? 'bg-rose-500 text-white'
                        : 'text-dark-500 hover:text-rose-400 hover:bg-rose-500/10'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDeleteId === gen.id ? 'Ketuk lagi untuk menghapus' : 'Hapus'}
                  </button>
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
