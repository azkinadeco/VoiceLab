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
  'Cinematic explosion boom',
  'Sci-fi laser blaster shot',
  'Gentle rain on window',
  'Temple bell harmonic chime',
  'Futuristic whoosh transition',
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

      <div className="studio-card rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div>
          <textarea
            rows={3}
            placeholder="Ketik deskripsi efek suara (cth: Cinematic explosion with deep sub bass)..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-xl bg-dark-950/60 border border-white/10 p-3.5 sm:p-4 text-sm text-white placeholder-dark-400 focus:border-pink-500 focus:outline-none resize-none"
          />

          <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-1.5 overflow-x-auto no-scrollbar fade-x sm:flex-wrap sm:overflow-visible sm:[mask-image:none] sm:[-webkit-mask-image:none]">
            {SAMPLE_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  haptic();
                  setPrompt(p);
                }}
                className="shrink-0 whitespace-nowrap h-9 sm:h-auto rounded-full sm:rounded-lg bg-dark-850 border border-white/10 px-3 sm:px-2.5 sm:py-1 text-[13px] sm:text-xs text-dark-200 hover:text-white hover:bg-dark-800 transition-colors"
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
