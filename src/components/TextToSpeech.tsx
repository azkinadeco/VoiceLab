'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Voice, Generation, GenerationSettings } from '@/lib/types';
import { ACCENT_CATEGORIES } from '@/lib/voices-data';
import {
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Download,
  BookOpen,
  Volume2,
  AlertTriangle,
  Loader2,
  Wand2,
  Trash2,
  Copy,
  Check,
  FileText,
  Share2,
  X,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import confetti from 'canvas-confetti';

interface TextToSpeechProps {
  voices: Voice[];
  selectedVoice: Voice;
  onSelectVoice: (voice: Voice) => void;
  onOpenVoiceSelector: () => void;
  onOpenPronunciation: () => void;
  onGenerationCreated: (gen: Generation) => void;
  isIphoneMode?: boolean;
  loadedGeneration?: Generation | null;
}

const SAMPLE_PROMPTS = [
  {
    title: '🛍️ Iklan Promo & Flash Sale (Olshop)',
    accentId: 'Indonesian',
    voiceId: 'voice-gadis',
    text: 'Halo bestie! Khusus hari ini jangan sampai kehabisan diskon payday sampai 50 persen plus gratis ongkir ke seluruh Indonesia. Langsung checkout sekarang sebelum kehabisan stok ya!',
  },
  {
    title: '📦 Review Produk & Keranjang Kuning',
    accentId: 'Indonesian',
    voiceId: 'voice-ardi',
    text: 'Jujur awalnya aku agak ragu beli barang ini, tapi setelah datang dan aku cobain sendiri seminggu, kualitasnya beneran gokil dan awet banget. Buat kalian yang cari barang serupa, link pembelian ada di bio ya!',
  },
  {
    title: '⚡ Hook Viral TikTok (Stop Scrolling)',
    accentId: 'Indonesian',
    voiceId: 'voice-gadis',
    text: 'Stop scrolling! Kalau kamu masih sering pusing mikirin cara bikin konten yang rapi tanpa perlu rekam suara sendiri, dengerin rahasia yang satu ini sampai habis!',
  },
  {
    title: '🍲 Kuliner & Food Review Viral',
    accentId: 'Indonesian',
    voiceId: 'voice-ardi',
    text: 'Gila sih, ini porsi makanan beneran brutal dan bumbunya beneran meresap sampai ke dalam! Lokasinya ada di pusat kota, harganya ramah di kantong dan buka sampai malam.',
  },
  {
    title: '🇮🇩 Aksen Jawa Ramah Pembeli',
    accentId: 'Indonesian (Jawa)',
    voiceId: 'voice-dimas-jawa',
    text: 'Sugeng rawuh para sedulur sedaya. Monggo dipun cobi produk unggulan menika, reginipun mirah sanget lan kualitasipun saestu sae.',
  },
  {
    title: '🇮🇩 Aksen Sunda Akrab Pedagang',
    accentId: 'Indonesian (Sunda)',
    voiceId: 'voice-jajang-sunda',
    text: 'Sampurasun wargi sadayana! Mangga ieu produkna anyar keneh, sae pisan kanggo dianggo sadidinten. Hayu geura di-checkout bilih kabujeng seep!',
  },
];

const EXPRESSION_PRESETS = [
  { label: 'Natural', speed: 1.0, pitch: 0, stability: 75, style: 15 },
  { label: 'Berita', speed: 1.05, pitch: -2, stability: 90, style: 25 },
  { label: 'Ekspresif', speed: 1.0, pitch: 3, stability: 60, style: 65 },
  { label: 'Lembut', speed: 0.9, pitch: -4, stability: 85, style: 10 },
];

const DEFAULT_SETTINGS: GenerationSettings = {
  speed: 1.0,
  pitch: 0,
  stability: 75,
  similarity: 80,
  styleExaggeration: 15,
  speakerBoost: true,
};

function detectLikelyIndonesianText(input: string): boolean {
  const lower = input.toLowerCase();
  const indoKeywords = [
    'yang',
    'dan',
    'di',
    'ini',
    'itu',
    'aku',
    'kamu',
    'anda',
    'untuk',
    'dengan',
    'tidak',
    'adalah',
    'akan',
    'halo',
    'selamat',
    'indonesia',
    'suara',
    'semua',
    'orang',
    'jangan',
    'apa',
    'setelah',
    'bisa',
    'dalam',
    'dari',
  ];
  const words = lower.split(/[^a-z]+/).filter(Boolean);
  if (words.length < 3) return false;
  const matches = words.filter((w) => indoKeywords.includes(w)).length;
  return matches >= 2;
}

export default function TextToSpeech({
  voices,
  selectedVoice,
  onSelectVoice,
  onOpenVoiceSelector,
  onOpenPronunciation,
  onGenerationCreated,
  isIphoneMode = false,
  loadedGeneration,
}: TextToSpeechProps) {
  const [text, setText] = useState(
    'Halo! Selamat datang di Voice Lab. Pilih aksen suara dan klik Generate untuk mendengar suara manusia neural.'
  );
  const [activeAccentFilter, setActiveAccentFilter] = useState<string>('Indonesian');
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastGen, setLastGen] = useState<Generation | null>(null);
  const [reuseNotice, setReuseNotice] = useState<string | null>(null);
  const [copiedTextNotice, setCopiedTextNotice] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved draft on mount if available
  useEffect(() => {
    const saved = localStorage.getItem('voicelab_creator_draft');
    if (saved && saved.trim().length > 0) {
      setText(saved);
    }
  }, []);

  // Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text && text.trim().length > 0) {
        localStorage.setItem('voicelab_creator_draft', text);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [text]);

  const handleAbortGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setErrorMsg('Proses render audio dibatalkan.');
  };

  useEffect(() => {
    if (loadedGeneration) {
      if (loadedGeneration.text) {
        setText(loadedGeneration.text);
      }
      if (loadedGeneration.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...loadedGeneration.settings });
      }
      setReuseNotice(`Memuat "${loadedGeneration.voiceName}" dari riwayat`);
      const timer = setTimeout(() => setReuseNotice(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [loadedGeneration]);

  // Floating popovers (hidden by default for zero visual clutter)
  const [showProsodyPopover, setShowProsodyPopover] = useState(false);
  const [showSamplePopover, setShowSamplePopover] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!isGenerating && text.trim().length > 0) {
          handleGenerate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [text, isGenerating, selectedVoice, settings]);

  const handleSelectAccentCategory = (accentId: string) => {
    setActiveAccentFilter(accentId);
    const matchingVoices = voices.filter((v) => {
      if (accentId === 'all') return true;
      if (accentId === 'European') return ['Spanish', 'French', 'German'].includes(v.accent);
      return v.accent === accentId;
    });
    if (matchingVoices.length > 0) {
      onSelectVoice(matchingVoices[0]);
    }
  };

  const handlePlayNeuralPreview = async (voice: Voice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (previewingVoiceId === voice.id) {
      previewAudioRef.current?.pause();
      setPreviewingVoiceId(null);
      return;
    }

    setPreviewingVoiceId(voice.id);
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id }),
      });
      if (!res.ok) throw new Error('Gagal memuat sampel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPreviewingVoiceId(null);
      };
      await audio.play();
    } catch {
      setPreviewingVoiceId(null);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim() || isGenerating) return;
    setIsGenerating(true);
    setErrorMsg(null);
    setShowProsodyPopover(false);
    setShowSamplePopover(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice.id,
          settings,
          type: 'tts',
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate suara');

      setLastGen(data.generation);
      onGenerationCreated(data.generation);

      confetti({
        particleCount: 30,
        spread: 45,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setErrorMsg('Proses render audio dibatalkan.');
      } else {
        setErrorMsg(err.message || 'Terjadi kesalahan saat menyintesis suara');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const downloadSubtitle = (gen: Generation, format: 'srt' | 'vtt') => {
    if (!gen.srtSubtitle) return;
    let content = gen.srtSubtitle;
    if (format === 'vtt') {
      content = 'WEBVTT\n\n' + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gen.voiceName}-${gen.id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isIndoTextWithForeignVoice =
    detectLikelyIndonesianText(text) &&
    !selectedVoice.accent.toLowerCase().includes('indonesia');

  return (
    <div className={`space-y-4 mx-auto ${isIphoneMode ? 'max-w-full' : 'max-w-3xl'}`}>
      {reuseNotice && (
        <div className="flex items-center gap-2 rounded-full bg-brand-500/20 border border-brand-500/30 px-3.5 py-1 text-xs text-brand-300 w-fit mx-auto animate-in fade-in slide-in-from-top-1">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          <span>{reuseNotice}</span>
        </div>
      )}

      {/* SINGLE UNIFIED ELEVENLABS / APPLE COMPOSER CARD */}
      <div className="studio-card relative rounded-3xl overflow-visible transition-all">
        {/* Top Minimal Accent Strip */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {ACCENT_CATEGORIES.filter((a) => a.id !== 'all').map((acc) => {
              const isActive =
                selectedVoice.accent === acc.id ||
                (acc.id === 'European' &&
                  ['Spanish', 'French', 'German'].includes(selectedVoice.accent));
              return (
                <button
                  key={acc.id}
                  onClick={() => handleSelectAccentCategory(acc.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0 ${
                    isActive
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-dark-300 hover:bg-white/[0.09] hover:text-white'
                  }`}
                >
                  <span>{acc.flag}</span>
                  <span>{acc.label.replace('English ', '').replace(' (Nasional)', '')}</span>
                </button>
              );
            })}
          </div>

          {/* Right Tiny Icon Triggers (Samples & Dictionary) */}
          <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/[0.08]">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSamplePopover(!showSamplePopover);
                  setShowProsodyPopover(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-dark-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                title="Contoh Naskah & Aksen"
              >
                <Wand2 className="h-4 w-4" />
              </button>

              {showSamplePopover && (
                <div className="absolute right-0 top-10 z-50 w-56 rounded-2xl bg-dark-900 border border-white/15 p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-dark-400">
                    Muat Contoh Naskah
                  </div>
                  {SAMPLE_PROMPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setText(sample.text);
                        setActiveAccentFilter(sample.accentId);
                        const targetV = voices.find((v) => v.id === sample.voiceId);
                        if (targetV) onSelectVoice(targetV);
                        setShowSamplePopover(false);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-dark-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenPronunciation}
              className="flex h-8 w-8 items-center justify-center rounded-full text-dark-300 hover:bg-white/[0.08] hover:text-white transition-colors"
              title="Kamus Pelafalan"
            >
              <BookOpen className="h-4 w-4" />
            </button>

            {text.length > 0 && (
              <button
                type="button"
                onClick={() => setText('')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-dark-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                title="Bersihkan Teks"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Creator & Olshop Script Chips */}
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-semibold text-dark-400 shrink-0 uppercase tracking-wider">
            Naskah Cepat:
          </span>
          {SAMPLE_PROMPTS.map((sample, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setText(sample.text);
                const targetV = voices.find((v) => v.id === sample.voiceId);
                if (targetV) onSelectVoice(targetV);
              }}
              className="rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-dark-200 hover:text-white transition-all shrink-0 active:scale-95"
            >
              {sample.title.split(' ')[0]} {sample.title.split(' ')[1] || ''}
            </button>
          ))}
        </div>

        {/* Clean Distraction-Free Text Canvas */}
        <div className="relative">
          <textarea
            rows={isIphoneMode ? 5 : 6}
            placeholder="Tulis naskah video TikTok, voiceover iklan produk, atau narasi konten di sini..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-transparent px-5 pt-4 pb-8 text-[15px] sm:text-base text-white placeholder-dark-500 focus:outline-none resize-none leading-relaxed"
          />
          <div className="absolute bottom-2 right-5 flex items-center gap-3 text-[11px] text-dark-400 select-none pointer-events-none">
            <span className="flex items-center gap-1 text-emerald-400/80">
              <Check className="h-3 w-3" />
              Tersimpan
            </span>
            <span>{text.length} karakter</span>
            <span>~{Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 2.8))}s audio</span>
          </div>
        </div>

        {/* Subtle Auto-Accent Match Pill (only when Indonesian text is typed with foreign voice) */}
        {isIndoTextWithForeignVoice && (
          <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2 text-xs text-amber-200">
            <span className="flex items-center gap-1.5 truncate">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              Teks Indonesia terdeteksi:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const ardi = voices.find((v) => v.id === 'voice-ardi');
                  if (ardi) onSelectVoice(ardi);
                }}
                className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-black"
              >
                🇮🇩 Pakai Ardi
              </button>
              <button
                onClick={() => {
                  const gadis = voices.find((v) => v.id === 'voice-gadis');
                  if (gadis) onSelectVoice(gadis);
                }}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white"
              >
                🇮🇩 Gadis
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mx-4 mb-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-4 py-2 text-xs text-rose-200 flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={handleGenerate}
              className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white"
            >
              Ulangi
            </button>
          </div>
        )}

        {/* Bottom Composer Control Bar (Only 3 Clean Elements: Voice Pill, Prosody Button, Generate Pill) */}
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
          {/* Left: Voice & Accent Selector Pill + Instant Sample Button */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={onOpenVoiceSelector}
              className="flex items-center gap-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.08] pl-1.5 pr-3 py-1.5 transition-all min-w-0"
            >
              <img
                src={selectedVoice.avatarUrl}
                alt={selectedVoice.name}
                className="h-6 w-6 rounded-full object-cover shrink-0"
              />
              <span className="text-xs font-semibold text-white truncate max-w-[110px] sm:max-w-[160px]">
                {selectedVoice.name}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-dark-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={(e) => handlePlayNeuralPreview(selectedVoice, e)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                previewingVoiceId === selectedVoice.id
                  ? 'bg-brand-500 border-brand-400 text-white animate-pulse'
                  : 'bg-white/[0.04] border-white/[0.08] text-dark-300 hover:text-white hover:bg-white/[0.09]'
              }`}
              title="Dengarkan sampel suara ini"
            >
              {previewingVoiceId === selectedVoice.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Prosody Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProsodyPopover(!showProsodyPopover);
                  setShowSamplePopover(false);
                }}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                  showProsodyPopover
                    ? 'bg-white text-black border-white'
                    : 'bg-white/[0.04] border-white/[0.08] text-dark-300 hover:text-white hover:bg-white/[0.09]'
                }`}
                title="Pengaturan Kecepatan & Nada"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>

              {showProsodyPopover && (
                <div className="absolute left-0 bottom-11 z-50 w-72 rounded-2xl bg-dark-900 border border-white/15 p-4 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Gaya & Prosodi</span>
                    <button
                      onClick={() => setSettings(DEFAULT_SETTINGS)}
                      className="text-[11px] text-dark-400 hover:text-white flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>

                  {/* Quick Expression Chips inside popover */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {EXPRESSION_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            speed: preset.speed,
                            pitch: preset.pitch,
                            stability: preset.stability,
                            styleExaggeration: preset.style,
                          })
                        }
                        className="rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1.5 text-xs font-medium text-dark-200 hover:text-white transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs text-dark-300 mb-1">
                        <span>Kecepatan</span>
                        <span className="font-mono text-white">{settings.speed.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.75"
                        step="0.05"
                        value={settings.speed}
                        onChange={(e) =>
                          setSettings({ ...settings, speed: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-dark-300 mb-1">
                        <span>Nada (Pitch)</span>
                        <span className="font-mono text-white">
                          {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch} Hz
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-25"
                        max="25"
                        step="1"
                        value={settings.pitch}
                        onChange={(e) =>
                          setSettings({ ...settings, pitch: parseInt(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-dark-300 mb-1">
                        <span>Ekspresi Intonasi</span>
                        <span className="font-mono text-white">{settings.styleExaggeration}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.styleExaggeration}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            styleExaggeration: parseInt(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: ElevenLabs / Apple High-Contrast White Pill Generate Button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={handleAbortGeneration}
              className="flex items-center gap-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-4 py-2 text-xs sm:text-sm font-bold shadow-lg transition-all active:scale-95 shrink-0"
              title="Batalkan render audio saat ini"
            >
              <X className="h-4 w-4" />
              <span>Batal</span>
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={text.trim().length === 0}
              className="flex items-center gap-2 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 px-5 py-2 text-xs sm:text-sm font-bold shadow-lg transition-all disabled:opacity-30 active:scale-95 shrink-0"
            >
              <Sparkles className="h-4 w-4 fill-zinc-950" />
              <span>Generate Voiceover</span>
            </button>
          )}
        </div>
      </div>

      {/* Minimal Result Player Card */}
      {lastGen && (
        <div className="studio-card rounded-3xl p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={lastGen.voiceAvatar}
                alt={lastGen.voiceName}
                className="h-6 w-6 rounded-full object-cover"
              />
              <span className="text-xs font-semibold text-white truncate">
                {lastGen.voiceName}
              </span>
              <span className="text-[11px] text-dark-400 font-mono">{lastGen.duration}s</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lastGen.text);
                  setCopiedTextNotice(true);
                  setTimeout(() => setCopiedTextNotice(false), 2000);
                }}
                className="flex items-center gap-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1 text-[11px] font-medium text-dark-200"
                title="Salin Naskah Teks"
              >
                {copiedTextNotice ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>Salin</span>
              </button>

              {lastGen.srtSubtitle && (
                <button
                  onClick={() => downloadSubtitle(lastGen, 'srt')}
                  className="flex items-center gap-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3 py-1 text-[11px] font-semibold text-amber-300 transition-colors"
                  title="Unduh Subtitle .SRT untuk CapCut, TikTok, atau Premiere"
                >
                  <FileText className="h-3 w-3" />
                  <span>Subtitle CapCut (.SRT)</span>
                </button>
              )}

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={() => {
                    navigator
                      .share({
                        title: `Voiceover ${lastGen.voiceName}`,
                        text: lastGen.text,
                        url: window.location.origin + lastGen.audioUrl,
                      })
                      .catch(() => {});
                  }}
                  className="flex items-center gap-1 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 transition-colors"
                  title="Bagikan ke WhatsApp, CapCut, atau TikTok"
                >
                  <Share2 className="h-3 w-3" />
                  <span>Kirim</span>
                </button>
              )}

              <a
                href={lastGen.audioUrl}
                download={`${lastGen.voiceName}-${lastGen.id}.mp3`}
                className="flex items-center gap-1 rounded-full bg-white text-black hover:bg-zinc-200 px-3.5 py-1 text-[11px] font-bold transition-colors shadow-sm"
              >
                <Download className="h-3 w-3" />
                <span>Unduh MP3</span>
              </a>
            </div>
          </div>

          <AudioWaveVisualizer
            audioUrl={lastGen.audioUrl}
            duration={lastGen.duration}
            autoPlay
            compact={isIphoneMode}
            fileName={`${lastGen.voiceName}-${lastGen.id}.mp3`}
          />
        </div>
      )}
    </div>
  );
}
