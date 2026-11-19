'use client';

import React, { useState } from 'react';
import { Generation } from '@/lib/types';
import { Sparkles, Wand2, Clock } from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';

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
      alert('Gagal menghasilkan SFX: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Generative Sound Effects (SFX)</h1>
          <TooltipInfo
            title="AI Sound FX Synthesizer"
            text="Ketik deskripsi efek suara (ledakan, laser, hujan, lonceng, whoosh) dan tentukan durasinya untuk menghasilkan file WAV 44.1kHz."
            position="right"
          />
        </div>
      </div>

      <div className="studio-card rounded-2xl p-6 space-y-5">
        <div>
          <textarea
            rows={3}
            placeholder="Ketik deskripsi efek suara (cth: Cinematic explosion with deep sub bass)..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-xl bg-dark-950/60 border border-white/10 p-4 text-sm text-white placeholder-dark-400 focus:border-pink-500 focus:outline-none resize-none"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SAMPLE_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(p)}
                className="rounded-lg bg-dark-850 border border-white/10 px-2.5 py-1 text-xs text-dark-200 hover:text-white hover:bg-dark-800 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
          <div className="flex items-center gap-3 flex-1 max-w-xs">
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
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:from-pink-400 hover:to-purple-500 transition-all disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" />
            {isGenerating ? 'Menyintesis SFX...' : 'Generate Sound Effect'}
          </button>
        </div>
      </div>

      {lastGen && (
        <div className="studio-card rounded-2xl border-pink-500/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              {lastGen.text}
            </span>
            <span className="text-xs text-dark-300 font-mono">WAV 44.1kHz</span>
          </div>
          <AudioWaveVisualizer audioUrl={lastGen.audioUrl} duration={lastGen.duration} autoPlay />
        </div>
      )}
    </div>
  );
}
