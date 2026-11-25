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
  Play,
  Pause,
  LayoutTemplate,
  Star,
} from 'lucide-react';
import TemplateSheet from './TemplateSheet';
import { CTA_SNIPPETS, PLATFORM_TARGETS, estimateSeconds } from '@/lib/script-templates';
import {
  getFavoriteVoiceIds,
  getRecentVoiceIds,
  pushRecentVoice,
  onVoicePrefsChange,
} from '@/lib/voice-prefs';
import { toast } from '@/lib/toast';
import { haptic } from '@/lib/haptics';
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
  onOpenTrimmer?: (url: string, duration: number, fileName?: string) => void;
}

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
  onOpenTrimmer,
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
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>('tiktok15');
  const [quickVoiceIds, setQuickVoiceIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const t = localStorage.getItem('voicelab_platform_target');
      if (t && PLATFORM_TARGETS.some((p) => p.id === t)) setTargetId(t);
    } catch {}
    const refresh = () => {
      const ids = [...getFavoriteVoiceIds(), ...getRecentVoiceIds()];
      setQuickVoiceIds(ids.filter((id, i) => ids.indexOf(id) === i));
    };
    refresh();
    return onVoicePrefsChange(refresh);
  }, []);

  const selectTarget = (id: string) => {
    setTargetId(id);
    try {
      localStorage.setItem('voicelab_platform_target', id);
    } catch {}
  };
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
      pushRecentVoice(selectedVoice.id);
      haptic([10, 40, 10]);

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

  // ---- Duration target (Batch 8) ----
  const estSec = estimateSeconds(text, settings.speed);
  const target = PLATFORM_TARGETS.find((p) => p.id === targetId) || PLATFORM_TARGETS[0];
  const targetPct = target.sec > 0 ? Math.min(100, (estSec / target.sec) * 100) : 0;
  const overTarget = target.sec > 0 && estSec > target.sec;
  const barColor = overTarget ? 'bg-rose-400' : targetPct > 85 ? 'bg-amber-400' : 'bg-emerald-400';

  // ---- Quick voices (favorites + recent), excluding the selected one ----
  const quickVoices = quickVoiceIds
    .filter((id) => id !== selectedVoice.id)
    .map((id) => voices.find((v) => v.id === id))
    .filter((v): v is Voice => Boolean(v))
    .slice(0, 6);
  const favIds = typeof window !== 'undefined' ? getFavoriteVoiceIds() : [];

  const appendCta = (cta: string) => {
    haptic(6);
    setText((prev) => {
      const base = prev.trim();
      if (base.includes(cta)) return prev;
      return base.length ? `${base.replace(/[.!?]?$/, (m) => m || '.')} ${cta}` : cta;
    });
  };

  const accentChips = ACCENT_CATEGORIES.filter((a) => a.id !== 'all');
  const isPreviewing = previewingVoiceId === selectedVoice.id;

  return (
    <div className={`space-y-3 sm:space-y-4 mx-auto ${isIphoneMode ? 'max-w-full' : 'max-w-3xl'}`}>
      {reuseNotice && (
        <div className="flex items-center gap-2 rounded-full bg-brand-500/20 border border-brand-500/30 px-3.5 py-1.5 text-[13px] text-brand-300 w-fit mx-auto animate-fadeIn">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          <span>{reuseNotice}</span>
        </div>
      )}

      {/* ================= VOICE CARD ================= */}
      <div className="studio-card rounded-3xl p-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenVoiceSelector}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 text-left active:bg-white/[0.05] transition-colors"
            aria-label="Ganti suara"
          >
            <img
              src={selectedVoice.avatarUrl}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover border border-white/10"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-semibold text-white">{selectedVoice.name}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-dark-400" />
              </div>
              <div className="truncate text-[12px] text-dark-400">
                {selectedVoice.accent} · {selectedVoice.gender === 'male' ? 'Pria' : selectedVoice.gender === 'female' ? 'Wanita' : 'Netral'}
                {selectedVoice.labels?.tone ? ` · ${selectedVoice.labels.tone}` : ''}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={(e) => handlePlayNeuralPreview(selectedVoice, e)}
            className={`mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
              isPreviewing
                ? 'bg-brand-500 border-brand-400 text-white'
                : 'bg-white/[0.06] border-white/[0.08] text-white'
            }`}
            aria-label={isPreviewing ? 'Hentikan sampel' : 'Dengarkan sampel suara'}
            title="Dengarkan sampel suara ini"
          >
            {isPreviewing ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white translate-x-[1px]" />}
          </button>
        </div>

        {/* Favorites + recently used voices (Batch 9) */}
        {quickVoices.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar fade-x border-t border-white/[0.06] px-1.5 pt-2 pb-0.5">
            {quickVoices.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  haptic(6);
                  onSelectVoice(v);
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] py-1 pl-1 pr-3 active:scale-95 transition-transform"
              >
                <img src={v.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-[12px] font-medium text-dark-200">{v.name.split(' ')[0]}</span>
                {favIds.includes(v.id) && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ================= COMPOSER CARD ================= */}
      <div className="studio-card relative rounded-3xl overflow-hidden">
        {/* Accent / language chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar fade-x border-b border-white/[0.06] px-3 py-2.5">
          {accentChips.map((acc) => {
            const isActive =
              selectedVoice.accent === acc.id ||
              (acc.id === 'European' && ['Spanish', 'French', 'German'].includes(selectedVoice.accent));
            return (
              <button
                key={acc.id}
                onClick={() => handleSelectAccentCategory(acc.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-white/[0.05] text-dark-300 hover:bg-white/[0.09] hover:text-white'
                }`}
              >
                <span>{acc.flag}</span>
                <span>{acc.label.replace('English ', '').replace(' (Nasional)', '').replace(/ \(.+\)$/, '')}</span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5">
          <button
            type="button"
            onClick={() => setIsTemplateOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-brand-500/15 border border-brand-500/30 px-3.5 text-[13px] font-semibold text-brand-200 active:scale-95 transition-transform"
          >
            <LayoutTemplate className="h-4 w-4" />
            Template Jualan
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onOpenPronunciation}
            className="flex h-9 w-9 items-center justify-center rounded-full text-dark-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="Kamus Pelafalan"
            aria-label="Kamus Pelafalan"
          >
            <BookOpen className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            disabled={text.length === 0}
            onClick={() => {
              setText('');
              toast('Naskah dibersihkan', 'info');
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-dark-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-30"
            title="Bersihkan Teks"
            aria-label="Bersihkan Teks"
          >
            <Trash2 className="h-[17px] w-[17px]" />
          </button>
        </div>

        {/* Text canvas */}
        <textarea
          rows={5}
          placeholder="Tulis naskah video TikTok, voiceover iklan produk, atau narasi konten di sini…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="block w-full min-h-[150px] bg-transparent px-4 pt-2 pb-2 text-[16px] text-white placeholder-dark-500 focus:outline-none resize-none leading-relaxed"
        />

        {/* Stats row */}
        <div className="flex items-center gap-3 px-4 pb-2 text-[12px] text-dark-400 select-none">
          <span className="flex items-center gap-1 text-emerald-400/80">
            <Check className="h-3.5 w-3.5" />
            Tersimpan
          </span>
          <span>{text.length} karakter</span>
          <span className="ml-auto font-medium text-dark-200">~{estSec} detik</span>
        </div>

        {/* Platform duration target (Batch 8) */}
        <div className="mx-3 mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-2.5 space-y-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {PLATFORM_TARGETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectTarget(p.id)}
                className={`shrink-0 flex-1 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap transition-all ${
                  targetId === p.id ? 'bg-white/15 text-white' : 'text-dark-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {target.sec > 0 && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${targetPct}%` }} />
              </div>
              <div className={`mt-1 text-[12px] ${overTarget ? 'text-rose-300' : 'text-dark-400'}`}>
                {overTarget
                  ? `Kelebihan ~${estSec - target.sec} detik — pangkas naskah atau naikkan kecepatan`
                  : `${estSec} dari ${target.sec} detik · sisa ~${target.sec - estSec} detik`}
              </div>
            </div>
          )}
        </div>

        {/* One-tap CTA */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar fade-x px-3 pb-3">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-dark-500">CTA</span>
          {CTA_SNIPPETS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => appendCta(c.text)}
              className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-dark-200 active:scale-95 transition-transform"
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Auto accent match */}
        {isIndoTextWithForeignVoice && (
          <div className="mx-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 text-[13px] text-amber-200">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              Teks Indonesia terdeteksi
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const ardi = voices.find((v) => v.id === 'voice-ardi');
                  if (ardi) onSelectVoice(ardi);
                }}
                className="rounded-full bg-amber-400 px-3 py-1 text-[12px] font-bold text-black"
              >
                🇮🇩 Ardi
              </button>
              <button
                onClick={() => {
                  const gadis = voices.find((v) => v.id === 'voice-gadis');
                  if (gadis) onSelectVoice(gadis);
                }}
                className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white"
              >
                🇮🇩 Gadis
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-[13px] text-rose-200">
            <span className="min-w-0">⚠️ {errorMsg}</span>
            <button
              onClick={handleGenerate}
              className="shrink-0 rounded-full bg-rose-500 px-3 py-1 text-[12px] font-semibold text-white"
            >
              Ulangi
            </button>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={() => setShowProsodyPopover(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] text-dark-200 active:scale-95 transition-transform"
            title="Pengaturan Kecepatan & Nada"
            aria-label="Pengaturan kecepatan dan nada"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
          {isGenerating ? (
            <button
              type="button"
              onClick={handleAbortGeneration}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-[15px] font-bold text-rose-200 active:scale-[0.99]"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Membuat suara… Batal</span>
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={text.trim().length === 0}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-zinc-950 shadow-lg transition-all disabled:opacity-30 active:scale-[0.99]"
            >
              <Sparkles className="h-5 w-5 fill-zinc-950" />
              <span>Generate Voiceover</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= RESULT CARD ================= */}
      {lastGen && (
        <div className="studio-card rounded-3xl p-3 sm:p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center gap-2 px-1">
            <img src={lastGen.voiceAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-white">{lastGen.voiceName}</div>
              <div className="text-[12px] text-dark-400">Siap dipakai · {lastGen.duration} detik</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(lastGen.text);
                setCopiedTextNotice(true);
                toast('Naskah disalin');
                setTimeout(() => setCopiedTextNotice(false), 2000);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-dark-200"
              title="Salin Naskah Teks"
              aria-label="Salin naskah"
            >
              {copiedTextNotice ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <AudioWaveVisualizer
            audioUrl={lastGen.audioUrl}
            duration={lastGen.duration}
            autoPlay
            compact={isIphoneMode}
            fileName={`${lastGen.voiceName}-${lastGen.id}.${lastGen.audioUrl.endsWith('.wav') || lastGen.audioUrl.startsWith('data:audio/wav') ? 'wav' : 'mp3'}`}
            onOpenTrimmer={
              onOpenTrimmer
                ? (url, dur) => onOpenTrimmer(url, dur, `${lastGen.voiceName}-${lastGen.id}.${lastGen.audioUrl.endsWith('.wav') || lastGen.audioUrl.startsWith('data:audio/wav') ? 'wav' : 'mp3'}`)
                : undefined
            }
          />

          <div className="grid grid-cols-3 gap-2">
            <a
              href={lastGen.audioUrl}
              download={`${lastGen.voiceName}-${lastGen.id}.${lastGen.audioUrl.endsWith('.wav') || lastGen.audioUrl.startsWith('data:audio/wav') ? 'wav' : 'mp3'}`}
              onClick={() => toast(`Mengunduh ${lastGen.audioUrl.endsWith('.wav') || lastGen.audioUrl.startsWith('data:audio/wav') ? 'WAV' : 'MP3'}…`, 'info')}
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-white text-[13px] font-bold text-black"
            >
              <Download className="h-4 w-4" />
              {lastGen.audioUrl.endsWith('.wav') || lastGen.audioUrl.startsWith('data:audio/wav') ? 'WAV' : 'MP3'}
            </a>
            <button
              disabled={!lastGen.srtSubtitle}
              onClick={() => {
                downloadSubtitle(lastGen, 'srt');
                toast('Subtitle .SRT diunduh');
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-[13px] font-semibold text-amber-200 disabled:opacity-30"
              title="Unduh Subtitle .SRT untuk CapCut, TikTok, atau Premiere"
            >
              <FileText className="h-4 w-4" />
              SRT
            </button>
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && 'share' in navigator) {
                  navigator
                    .share({
                      title: `Voiceover ${lastGen.voiceName}`,
                      text: lastGen.text,
                      url: window.location.origin + lastGen.audioUrl,
                    })
                    .catch(() => {});
                } else {
                  (window.navigator as Navigator).clipboard?.writeText(window.location.origin + lastGen.audioUrl);
                  toast('Link audio disalin');
                }
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-[13px] font-semibold text-indigo-200"
              title="Bagikan ke WhatsApp, CapCut, atau TikTok"
            >
              <Share2 className="h-4 w-4" />
              Kirim
            </button>
          </div>
        </div>
      )}

      {/* ================= PROSODY SHEET ================= */}
      {showProsodyPopover && (
        <div
          className="m-sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setShowProsodyPopover(false)}
        >
          <div
            role="dialog"
            aria-label="Gaya dan prosodi"
            onClick={(e) => e.stopPropagation()}
            className="m-sheet flex w-full max-w-sm flex-col rounded-3xl border border-white/10 bg-dark-900 shadow-2xl"
          >
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[17px] font-bold text-white">Gaya & Kecepatan</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] text-dark-300 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  <button
                    onClick={() => setShowProsodyPopover(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-dark-200"
                    aria-label="Tutup"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {EXPRESSION_PRESETS.map((preset) => {
                  const active =
                    settings.speed === preset.speed &&
                    settings.pitch === preset.pitch &&
                    settings.styleExaggeration === preset.style;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        haptic(6);
                        setSettings({
                          ...settings,
                          speed: preset.speed,
                          pitch: preset.pitch,
                          stability: preset.stability,
                          styleExaggeration: preset.style,
                        });
                      }}
                      className={`h-10 rounded-xl text-[13px] font-medium transition-colors ${
                        active ? 'bg-white text-black font-semibold' : 'bg-white/[0.06] text-dark-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {[
                {
                  label: 'Kecepatan',
                  value: `${settings.speed.toFixed(2)}x`,
                  input: (
                    <input
                      type="range"
                      min="0.5"
                      max="1.75"
                      step="0.05"
                      value={settings.speed}
                      onChange={(e) => setSettings({ ...settings, speed: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  ),
                },
                {
                  label: 'Nada (Pitch)',
                  value: `${settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch} Hz`,
                  input: (
                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="1"
                      value={settings.pitch}
                      onChange={(e) => setSettings({ ...settings, pitch: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  ),
                },
                {
                  label: 'Ekspresi Intonasi',
                  value: `${settings.styleExaggeration}%`,
                  input: (
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.styleExaggeration}
                      onChange={(e) => setSettings({ ...settings, styleExaggeration: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  ),
                },
              ].map((row) => (
                <div key={row.label} data-no-swipe>
                  <div className="mb-2 flex justify-between text-[13px] text-dark-300">
                    <span>{row.label}</span>
                    <span className="font-mono text-white">{row.value}</span>
                  </div>
                  {row.input}
                </div>
              ))}

              <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-[12px] text-dark-400">
                Estimasi durasi dengan kecepatan ini: <span className="font-semibold text-white">~{estSec} detik</span>
              </div>

              <button
                onClick={() => setShowProsodyPopover(false)}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[15px] font-bold text-black"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      <TemplateSheet
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onApply={(filled, tpl) => {
          setText(filled);
          const v = voices.find((x) => x.id === tpl.voiceId);
          if (v) onSelectVoice(v);
          const match = PLATFORM_TARGETS.find((p) => p.sec === tpl.targetSec);
          if (match) selectTarget(match.id);
          toast(`Template "${tpl.title}" dipakai`);
        }}
      />
    </div>
  );
}
