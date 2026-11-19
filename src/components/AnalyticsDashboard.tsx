'use client';

import React, { useState } from 'react';
import { Generation } from '@/lib/types';
import {
  BarChart3,
  HardDrive,
  Code2,
  Download,
  Upload,
  Trash2,
  Check,
  Copy,
  Sparkles,
  Clock,
  FileAudio,
  Users,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  generations: Generation[];
  storageStats: any;
  onRefreshAll: () => void;
}

export default function AnalyticsDashboard({
  generations,
  storageStats,
  onRefreshAll,
}: AnalyticsDashboardProps) {
  const [embedTheme, setEmbedTheme] = useState<'obsidian' | 'indigo' | 'light'>('obsidian');
  const [selectedGenId, setSelectedGenId] = useState<string>(generations[0]?.id || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const selectedGen = generations.find((g) => g.id === selectedGenId) || generations[0];

  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voicelab-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Gagal mengekspor backup');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = await fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import_backup',
            database: parsed.database || parsed,
          }),
        });
        if (res.ok) {
          onRefreshAll();
          alert('Backup database berhasil dipulihkan!');
        }
      } catch {
        alert('File JSON backup tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearGenerations = async () => {
    if (!confirm('Hapus seluruh file riwayat audio dari storage PC untuk mengosongkan ruang disk?')) {
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_generations' }),
      });
      if (res.ok) {
        onRefreshAll();
      }
    } finally {
      setIsClearing(false);
    }
  };

  const totalChars =
    storageStats?.totalCharacters ??
    generations.reduce((acc, g) => acc + (g.text?.length || 0), 0);
  const totalSec =
    storageStats?.totalDurationSec ??
    Math.round(generations.reduce((acc, g) => acc + (g.duration || 0), 0));

  const byVoice: Record<string, number> = storageStats?.byVoice || {};
  const voiceEntries = Object.entries(byVoice).sort((a, b) => b[1] - a[1]);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const audioFullUrl = selectedGen ? `${originUrl}${selectedGen.audioUrl}` : `${originUrl}/api/storage`;

  const embedHtmlSnippet = `<!-- ElevenLabs Audio Native Widget by Voice Lab -->
<div style="background:${
    embedTheme === 'light' ? '#f8fafc' : embedTheme === 'indigo' ? '#1e1b4b' : '#0c0e12'
  };color:${
    embedTheme === 'light' ? '#0f172a' : '#ffffff'
  };padding:16px;border-radius:16px;border:1px solid rgba(99,102,241,0.25);max-width:480px;font-family:sans-serif;">
  <div style="font-size:12px;font-weight:700;margin-bottom:8px;">🎙️ Listen to Article (${
    selectedGen?.voiceName || 'AI Voice'
  })</div>
  <audio controls preload="metadata" src="${audioFullUrl}" style="width:100%;height:36px;"></audio>
</div>`;

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedHtmlSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-dark-900 border border-white/10 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-dark-400">
            <span>Total Karakter Tersintesis</span>
            <BarChart3 className="h-4 w-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {totalChars.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-400">Kuota Lokal: Tanpa Batas (Unlimited)</p>
        </div>

        <div className="rounded-2xl bg-dark-900 border border-white/10 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-dark-400">
            <span>Total Durasi Audio</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalSec}s</div>
          <p className="text-[11px] text-dark-400">
            ~{(totalSec / 60).toFixed(1)} menit audio neural
          </p>
        </div>

        <div className="rounded-2xl bg-dark-900 border border-white/10 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-dark-400">
            <span>Total File Generasi</span>
            <FileAudio className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {generations.length}
          </div>
          <p className="text-[11px] text-dark-400">MP3 & WAV tersimpan di disk</p>
        </div>

        <div className="rounded-2xl bg-dark-900 border border-white/10 p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-dark-400">
            <span>Pemakaian Disk PC</span>
            <HardDrive className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {storageStats?.diskUsageFormatted || '0.00 MB'}
          </div>
          <p className="text-[11px] text-dark-400 truncate">Path: data/audio/</p>
        </div>
      </div>

      {/* Voice Usage Breakdown & PC Storage Backup Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Voice Distribution Chart */}
        <div className="lg:col-span-7 rounded-2xl bg-dark-900 border border-white/10 p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-400" />
            Statistik Penggunaan Karakter Suara
          </h3>

          {voiceEntries.length === 0 ? (
            <p className="text-xs text-dark-400 py-8 text-center">
              Belum ada statistik suara. Buat generasi pertama Anda!
            </p>
          ) : (
            <div className="space-y-3">
              {voiceEntries.slice(0, 6).map(([vName, count]) => {
                const pct = Math.min(
                  100,
                  Math.round((count / Math.max(1, generations.length)) * 100)
                );
                return (
                  <div key={vName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white font-medium">{vName}</span>
                      <span className="text-dark-400 font-mono">
                        {count} file ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-dark-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Backup, Restore & Disk Cleanup */}
        <div className="lg:col-span-5 rounded-2xl bg-dark-900 border border-white/10 p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-emerald-400" />
              Manajemen Data & Backup PC Lokal
            </h3>
            <p className="text-xs text-dark-400 leading-relaxed">
              Cadangkan seluruh suara kloning, kamus pelafalan, proyek buku audio, dan riwayat ke file JSON, atau bersihkan ruang penyimpanan PC.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleExportBackup}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              <Download className="h-4 w-4" />
              Export Full Database Backup (.JSON)
            </button>

            <label className="w-full flex items-center justify-center gap-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-white/10 px-4 py-2.5 text-xs font-semibold text-white cursor-pointer transition-colors">
              <Upload className="h-4 w-4 text-cyan-400" />
              Restore / Import Database Backup
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>

            <button
              onClick={handleClearGenerations}
              disabled={isClearing || generations.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 px-4 py-2.5 text-xs font-semibold text-rose-300 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              {isClearing ? 'Membersihkan...' : 'Bersihkan Semua File Riwayat Audio'}
            </button>
          </div>
        </div>
      </div>

      {/* Batch 7: ElevenLabs Audio Native Embeddable Player Generator */}
      <div className="rounded-2xl bg-dark-900 border border-white/10 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Code2 className="h-5 w-5 text-brand-400" />
              ElevenLabs Audio Native (Embeddable Website Player)
            </h3>
            <p className="text-xs text-dark-400 mt-0.5">
              Pasang pemutar suara artikel otomatis di blog, WordPress, Next.js, atau website Anda.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { id: 'obsidian', label: 'Obsidian Dark' },
                { id: 'indigo', label: 'Indigo Glow' },
                { id: 'light', label: 'Minimal Light' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setEmbedTheme(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  embedTheme === t.id
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-850 text-dark-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          {/* Left: Widget Preview */}
          <div className="space-y-3">
            <label className="block text-xs text-dark-300">
              Pilih Audio Generasi untuk Di-embed:
            </label>
            <select
              value={selectedGenId}
              onChange={(e) => setSelectedGenId(e.target.value)}
              className="w-full rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs text-white"
            >
              {generations.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.voiceName} — {g.text.slice(0, 60)}...
                </option>
              ))}
            </select>

            <div className="pt-2">
              <div className="text-[11px] text-dark-400 mb-2">Live Widget Preview:</div>
              <div
                className={`rounded-2xl p-4 border transition-all ${
                  embedTheme === 'light'
                    ? 'bg-slate-50 text-slate-900 border-slate-300'
                    : embedTheme === 'indigo'
                    ? 'bg-indigo-950 text-white border-indigo-500/40'
                    : 'bg-dark-950 text-white border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                    Listen to Article • {selectedGen?.voiceName || 'Voice Lab AI'}
                  </span>
                  <span className="text-[10px] opacity-60">Powered by Voice Lab</span>
                </div>
                {selectedGen ? (
                  <audio controls src={selectedGen.audioUrl} className="w-full h-9" />
                ) : (
                  <div className="text-xs opacity-60 py-2">
                    Generate audio terlebih dahulu untuk melihat preview player.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Embed Snippet Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-dark-300">HTML Embed Code Snippet</span>
              <button
                onClick={copyEmbedCode}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500/20 text-brand-300 px-3 py-1 text-xs font-medium hover:bg-brand-500/30"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? 'Tersalin!' : 'Copy HTML Snippet'}
              </button>
            </div>
            <pre className="rounded-xl bg-dark-950 border border-white/10 p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
              {embedHtmlSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
