'use client';

import React, { useState } from 'react';
import { Voice, Generation } from '@/lib/types';
import {
  Check,
  Upload,
  Sparkles,
  Plus,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';
import PageHeader from './PageHeader';
import { haptic } from '@/lib/haptics';

interface BatchGeneratorProps {
  voices: Voice[];
  onGenerationCreated: (gen: Generation) => void;
}

interface BatchItem {
  id: string;
  text: string;
  voiceId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  audioUrl?: string;
  duration?: number;
}

export default function BatchGenerator({ voices, onGenerationCreated }: BatchGeneratorProps) {
  const [defaultVoiceId, setDefaultVoiceId] = useState(voices[0]?.id || 'voice-ardi');
  const [rawInput, setRawInput] = useState(
    `Selamat datang di layanan otomatis Voice Lab.\nTekan angka satu untuk berbicara dengan layanan pelanggan.\nTekan angka dua untuk informasi saldo dan tagihan Anda.`
  );
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const parseLinesToQueue = () => {
    const lines = rawInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const created: BatchItem[] = lines.map((line, i) => ({
      id: `batch-${Date.now()}-${i}`,
      text: line,
      voiceId: defaultVoiceId,
      status: 'pending',
    }));
    setItems(created);
    setCompletedCount(0);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setRawInput(content);
    };
    reader.readAsText(file);
  };

  const runBatchQueue = async () => {
    if (items.length === 0 || isRunning) return;
    setIsRunning(true);
    setCompletedCount(0);

    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'processing' };
      setItems([...updated]);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: updated[i].text,
            voiceId: updated[i].voiceId,
            type: 'batch',
            settings: {
              speed: 1.0,
              pitch: 0,
              stability: 80,
              similarity: 85,
            },
          }),
        });
        const data = await res.json();
        if (res.ok && data.generation) {
          updated[i] = {
            ...updated[i],
            status: 'done',
            audioUrl: data.generation.audioUrl,
            duration: data.generation.duration,
          };
          onGenerationCreated(data.generation);
        } else {
          updated[i] = { ...updated[i], status: 'error' };
        }
      } catch {
        updated[i] = { ...updated[i], status: 'error' };
      }

      setCompletedCount(i + 1);
      setItems([...updated]);
    }

    setIsRunning(false);
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="Batch CSV & Multi-Line Generator"
        mobileTitle="Batch Naskah"
        subtitle="Satu baris teks = satu file MP3. Tempel naskah atau import file."
        titleAddon={
          <TooltipInfo
            title="Bulk Voice Queue"
            text="Satu baris teks akan di-generate menjadi satu file MP3 terpisah secara otomatis."
            position="right"
          />
        }
        actions={
          <label className="flex items-center gap-1.5 h-10 sm:h-auto rounded-xl bg-dark-900 border border-white/10 px-3.5 sm:py-2 text-[13px] sm:text-xs font-semibold text-dark-200 hover:text-white whitespace-nowrap cursor-pointer">
            <Upload className="h-3.5 w-3.5 text-blue-400" />
            Import .TXT / .CSV
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>
        }
      />

      <div className="studio-card rounded-2xl p-4 sm:p-5 space-y-4">
        <textarea
          rows={6}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Baris 1...\nBaris 2...\nBaris 3..."
          className="w-full rounded-xl bg-dark-950/60 border border-white/10 p-3.5 text-sm text-white sm:font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
        />

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <select
              value={defaultVoiceId}
              onChange={(e) => setDefaultVoiceId(e.target.value)}
              className="flex-1 sm:flex-none min-w-0 h-11 sm:h-auto rounded-xl bg-dark-850 border border-white/10 px-3 sm:py-2 text-xs font-semibold text-white"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  🎙️ {v.name} ({v.accent})
                </option>
              ))}
            </select>
            <span className="shrink-0 text-xs text-dark-300 font-mono">
              {rawInput.split('\n').filter((l) => l.trim()).length} baris
            </span>
          </div>

          <button
            onClick={() => {
              haptic();
              parseLinesToQueue();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl sm:rounded-xl bg-blue-600 hover:bg-blue-500 px-4 h-12 sm:h-auto sm:py-2 text-sm sm:text-xs font-bold text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Siapkan Antrean
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="studio-card rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 text-xs font-bold text-white">
                Progres: {completedCount} / {items.length}
              </span>
              <div className="h-2 flex-1 sm:flex-none sm:w-40 rounded-full bg-dark-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${(completedCount / items.length) * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={runBatchQueue}
              disabled={isRunning}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl sm:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 h-12 sm:h-auto sm:py-2 text-sm sm:text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isRunning ? 'Memproses...' : 'Generate Semua Baris'}
            </button>
          </div>

          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-xl bg-dark-850/90 border border-white/10 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-mono text-dark-400">#{idx + 1}</span>
                    <p className="text-[13px] sm:text-xs text-white truncate">{item.text}</p>
                  </div>

                  <div className="shrink-0">
                    {item.status === 'pending' && (
                      <span className="rounded bg-dark-750 px-2 py-0.5 text-[11px] text-dark-300">
                        Antre
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[11px] text-blue-300 animate-pulse">
                        Proses...
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Selesai
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] text-rose-300">
                        Gagal
                      </span>
                    )}
                  </div>
                </div>

                {item.audioUrl && (
                  <AudioWaveVisualizer
                    audioUrl={item.audioUrl}
                    duration={item.duration}
                    compact
                    fileName={`batch-line-${idx + 1}.mp3`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
