'use client';

import React, { useState } from 'react';
import { Generation } from '@/lib/types';
import { Sparkles, Wand2, Clock } from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';
import PageHeader from './PageHeader';
import { toast } from '@/lib/toast';
import { haptic } from '@/lib/haptics';

interface SoundEffectsProps {
  onGenerationCreated: (gen: Generation) => void;
}

const SAMPLE_PROMPTS = [
  '💥 Ledakan dahsyat',
  '🌧️ Hujan deras',
  '🔔 Lonceng notifikasi',
  '💨 Angin transisi whoosh',
  '👏 Tepuk tangan penonton',
  '🚨 Sirine alarm',
];

export default function SoundEffects({ onGenerationCreated }: SoundEffectsProps) {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(3.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGen, setLastGen] = useState<Generation | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    try {
      const res = await fetch('/api/sfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          duration,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLastGen(data.generation);
      onGenerationCreated(data.generation);
    } catch (err: any) {
      toast('Gagal menghasilkan SFX: ' + err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      <PageHeader
        title="Generative Sound Effects (SFX)"
        mobileTitle="Efek Suara"
        subtitle="Ketik deskripsi, atur durasi, dan hasilkan efek suara WAV."
        titleAddon={
          <TooltipInfo
            title="AI Sound FX Synthesizer"
            text="Ketik deskripsi efek suara (ledakan, laser, hujan, lonceng, whoosh) dan tentukan durasinya untuk menghasilkan file WAV 44.1kHz."
            position="right"
          />
        }
      />

      <div className="studio-card rounded-2xl p-3.5 sm:p-5 space-y-4">
        <div>
          <textarea
            rows={3}
            placeholder="Deskripsikan efek suara… (cth: hujan deras, ledakan, lonceng)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] p-3 text-[14px] text-white placeholder-dark-500 focus:ring-1 focus:ring-pink-500 focus:outline-none resize-none"
          />

          <div className="mt-2.5 flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap">
            {SAMPLE_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  haptic();
                  setPrompt(p.replace(/^[^\w]+/, '').trim());
                }}
                className="shrink-0 whitespace-nowrap h-9 rounded-full bg-white/[0.05] px-3 text-[12.5px] text-dark-200 hover:text-white hover:bg-white/[0.1] active:scale-95 transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
          <div className="flex items-center gap-3 flex-1 sm:max-w-xs min-w-0">
            <span className="text-xs font-semibold text-dark-200 flex items-center gap-1.5 shrink-0">
              <Clock className="h-3.5 w-3.5 text-pink-400" />
              Durasi: <strong className="text-white font-mono">{duration.toFixed(1)}s</strong>
            </span>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl sm:rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 h-12 sm:h-auto sm:py-2.5 text-sm sm:text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:from-pink-400 hover:to-purple-500 transition-all disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" />
            {isGenerating ? 'Menyintesis SFX...' : 'Buat Efek Suara'}
          </button>
        </div>
      </div>

      {lastGen && (
        <div className="studio-card rounded-2xl border-pink-500/40 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5 min-w-0 truncate">
              <Sparkles className="h-4 w-4" />
              {lastGen.text}
            </span>
            <span className="text-xs text-dark-300 font-mono shrink-0">WAV 44.1kHz</span>
          </div>
          <AudioWaveVisualizer audioUrl={lastGen.audioUrl} duration={lastGen.duration} autoPlay />
        </div>
      )}
    </div>
  );
}
