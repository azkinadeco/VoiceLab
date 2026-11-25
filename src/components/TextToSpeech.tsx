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
import {
  computeTokenQuota,
  recordTokenUsage,
  resetTokenQuota,
  syncElevenLabsLiveQuota,
  formatTokenNumber,
  estimateScriptTokens,
  TokenQuotaSnapshot,
} from '@/lib/token-quota';

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

const ANIME_GAME_LINES = [
  { label: 'Greet', text: 'おかえりなさい、司令官。今日も一緒に戦いましょうね！' },
  { label: 'Tsundere', text: 'ふん、やっと来たのね。べ、別に待ってなんかいないんだから！' },
  { label: 'Menggoda', text: 'あら、いい子ね。こっちにいらっしゃい…今夜も私に会いに来たの？' },
  { label: 'Sedih', text: 'お願い…もう二度と、私を一人にしないで…' },
  { label: 'Marah / Skill', text: '覚悟しなさい！竜の炎よ、すべてを焼き尽くせ！' },
  { label: 'Dingin', text: '…潮が、あなたの帰りを知らせてくれた。邪魔はさせない。' },
  { label: 'Win', text: '当然の結果よ。私を誰だと思ってるの？' },
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
    'Halo! Selamat datang di Voice Lab, pilih suara dan klik Generate.'
  );
  const [activeAccentFilter, setActiveAccentFilter] = useState<string>('Indonesian');
  const [ttsEngine, setTtsEngine] = useState<'auto' | 'gemini-tts' | 'elevenlabs-api' | 'freetts-api' | 'voicevox'>('auto');
  const [vvStatus, setVvStatus] = useState<{
    checked: boolean;
    online: boolean;
    version?: string;
    speakers: { id: number; label: string }[];
  }>({ checked: false, online: false, speakers: [] });
  const [vvSpeakerId, setVvSpeakerId] = useState<number | undefined>(undefined);
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [lastGen, setLastGen] = useState<Generation | null>(null);
  const [reuseNotice, setReuseNotice] = useState<string | null>(null);
  const [copiedTextNotice, setCopiedTextNotice] = useState(false);
  const [tokenQuota, setTokenQuota] = useState<TokenQuotaSnapshot>(() => computeTokenQuota([]));
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshQuotaFromHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setTokenQuota(computeTokenQuota(Array.isArray(data.generations) ? data.generations : []));
    } catch {
      setTokenQuota(computeTokenQuota([]));
    }
  };

  const syncLiveElevenQuota = async () => {
    try {
      let clientKeys: Record<string, string> | undefined;
      try {
        const raw = localStorage.getItem('voicelab_client_keys');
        if (raw) clientKeys = JSON.parse(raw);
      } catch {}
      const res = await fetch('/api/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKeys }),
      });
      const data = await res.json();
      if (data?.elevenlabs?.configured && typeof data.elevenlabs.used === 'number') {
        syncElevenLabsLiveQuota(data.elevenlabs.used, data.elevenlabs.limit);
      }
    } catch {}
  };

  // Load saved draft & engine preference on mount if available
  useEffect(() => {
    const saved = localStorage.getItem('voicelab_creator_draft');
    if (saved && saved.trim().length > 0) {
      setText(saved);
    }
    const savedEngine = localStorage.getItem('voicelab_tts_engine');
    if (
      savedEngine === 'auto' ||
      savedEngine === 'gemini-tts' ||
      savedEngine === 'elevenlabs-api' ||
      savedEngine === 'freetts-api' ||
      savedEngine === 'voicevox'
    ) {
      setTtsEngine(savedEngine);
    }
    refreshQuotaFromHistory();
    syncLiveElevenQuota();
    const onQuotaUpdate = () => {
      refreshQuotaFromHistory();
    };
    window.addEventListener('voicelab-quota-updated', onQuotaUpdate);
    return () => window.removeEventListener('voicelab-quota-updated', onQuotaUpdate);
  }, []);

  const checkVoicevox = async () => {
    try {
      const res = await fetch('/api/voicevox');
      const data = await res.json();
      setVvStatus({
        checked: true,
        online: Boolean(data.online),
        version: data.version,
        speakers: Array.isArray(data.speakers) ? data.speakers : [],
      });
    } catch {
      setVvStatus({ checked: true, online: false, speakers: [] });
    }
  };

  useEffect(() => {
    if (ttsEngine === 'voicevox') {
      checkVoicevox();
    }
  }, [ttsEngine]);

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

  // Floating popovers & collapsible extras (hidden by default for clean mobile layout)
  const [showProsodyPopover, setShowProsodyPopover] = useState(false);
  const [showExtras, setShowExtras] = useState<'none' | 'duration' | 'cta' | 'anime'>('none');
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
      let clientKeys: Record<string, string> | undefined;
      try {
        const raw = localStorage.getItem('voicelab_client_keys');
        if (raw) clientKeys = JSON.parse(raw);
      } catch {}

      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          provider: ttsEngine === 'auto' ? undefined : ttsEngine,
          clientKeys,
        }),
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
    setFallbackNotice(null);
    setShowProsodyPopover(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let clientKeys: Record<string, string> | undefined;
      try {
        const raw = localStorage.getItem('voicelab_client_keys');
        if (raw) clientKeys = JSON.parse(raw);
      } catch {}

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice.id,
          settings: {
            ...settings,
            voicevoxSpeakerId: ttsEngine === 'voicevox' ? vvSpeakerId : undefined,
          },
          type: 'tts',
          provider: ttsEngine === 'auto' ? undefined : ttsEngine,
          clientKeys,
        }),
        signal: controller.signal,
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server mengembalikan respons non-JSON (HTTP ${res.status}): ${rawText.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(data?.error || `Gagal generate suara (HTTP ${res.status})`);

      setLastGen(data.generation);
      setFallbackNotice(data.fallbackNotice || null);
      recordTokenUsage({
        engineLabel: data.generation?.model,
        text: text.trim(),
        fallbackNotice: data.fallbackNotice || null,
      });
      refreshQuotaFromHistory();
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
        const msg = err.message || 'Terjadi kesalahan saat menyintesis suara';
        setErrorMsg(msg);
        if (msg.includes('429')) {
          recordTokenUsage({
            engineLabel: '',
            text: text.trim(),
            fallbackNotice: ttsEngine === 'freetts-api' ? 'FreeTTS 429' : 'Gemini 429',
          });
          refreshQuotaFromHistory();
        }
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
  const isAnimeMode = selectedVoice.accent === 'Anime JP' || selectedVoice.language === 'Japanese';
  const isElevenMode = selectedVoice.accent === 'ElevenLabs';
  const animeVoices = voices.filter((v) => v.accent === 'Anime JP');
  const elevenVoices = voices.filter((v) => v.accent === 'ElevenLabs');

  return (
    <div className={`space-y-3 mx-auto ${isIphoneMode ? 'max-w-full' : 'max-w-2xl'}`}>
      {reuseNotice && (
        <div className="flex items-center gap-2 rounded-full bg-brand-500/20 border border-brand-500/30 px-3 py-1 text-[12px] text-brand-200 w-fit mx-auto animate-fadeIn">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          <span>{reuseNotice}</span>
        </div>
      )}

      {/* ================= UNIFIED CLEAN WORKSPACE CARD ================= */}
      <div className="studio-card rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
        {/* 1. Top Bar: Selected Voice + Sample Play + Engine Switcher */}
        <div className="p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenVoiceSelector}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors"
              aria-label="Ganti suara"
            >
              <img
                src={selectedVoice.avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover border border-white/15"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[14px] font-bold text-white">{selectedVoice.name}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-dark-400" />
                </div>
                <div className="truncate text-[11.5px] text-dark-400">
                  {selectedVoice.accent} · {selectedVoice.gender === 'male' ? 'Pria' : selectedVoice.gender === 'female' ? 'Wanita' : 'Netral'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => handlePlayNeuralPreview(selectedVoice, e)}
              className={`flex h-9 px-3 shrink-0 items-center gap-1.5 rounded-full border text-[12px] font-semibold transition-all active:scale-95 ${
                isPreviewing
                  ? 'bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/30'
                  : 'bg-white/[0.06] border-white/[0.08] text-dark-200 hover:text-white hover:bg-white/[0.1]'
              }`}
              aria-label={isPreviewing ? 'Hentikan sampel' : 'Dengarkan sampel suara'}
            >
              {isPreviewing ? (
                <>
                  <div className="flex items-end gap-[2px] h-3">
                    <span className="w-[2.5px] h-full rounded-full bg-white eq-bar" />
                    <span className="w-[2.5px] h-full rounded-full bg-white eq-bar eq-bar-2" />
                    <span className="w-[2.5px] h-full rounded-full bg-white eq-bar eq-bar-3" />
                  </div>
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Sampel</span>
                </>
              )}
            </button>
          </div>

          {/* Engine Switcher Row (5 clean options including ElevenLabs) */}
          <div className="grid grid-cols-5 items-center rounded-xl bg-white/[0.04] p-1 text-[11.5px]">
            {(
              [
                { id: 'auto', label: 'Auto' },
                { id: 'gemini-tts', label: '✨ Gemini' },
                { id: 'elevenlabs-api', label: '🎙️ Eleven' },
                { id: 'freetts-api', label: '⚡ FreeTTS' },
                { id: 'voicevox', label: '🎌 VOICEVOX' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  haptic(5);
                  setTtsEngine(opt.id);
                  if (opt.id === 'voicevox' && selectedVoice.accent !== 'Anime JP') {
                    const firstAnime = voices.find((v) => v.accent === 'Anime JP');
                    if (firstAnime) onSelectVoice(firstAnime);
                  } else if (opt.id === 'elevenlabs-api') {
                    syncLiveElevenQuota();
                  }
                  try {
                    localStorage.setItem('voicelab_tts_engine', opt.id);
                  } catch {}
                }}
                className={`h-8 rounded-lg px-1.5 font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  ttsEngine === opt.id
                    ? opt.id === 'voicevox'
                      ? 'bg-emerald-400 text-black shadow-sm'
                      : 'bg-white text-black shadow-sm'
                    : 'text-dark-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Ultra-Compact Single-Row Token Quota Indicator (Small, Neat, Zero Space Waste) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg bg-white/[0.025] border border-white/[0.05] px-2.5 py-1 text-[11px] font-mono">
            {[
              {
                name: '✨ Gemini',
                q: tokenQuota.gemini,
                dot:
                  tokenQuota.gemini.percent >= 90
                    ? 'bg-rose-400'
                    : tokenQuota.gemini.percent >= 70
                      ? 'bg-amber-400'
                      : 'bg-emerald-400',
              },
              {
                name: '🎙️ ElevenLabs',
                q: tokenQuota.elevenlabs,
                dot:
                  tokenQuota.elevenlabs.percent >= 90
                    ? 'bg-rose-400'
                    : tokenQuota.elevenlabs.percent >= 70
                      ? 'bg-amber-400'
                      : 'bg-violet-400',
              },
              {
                name: '⚡ FreeTTS',
                q: tokenQuota.freetts,
                dot:
                  tokenQuota.freetts.percent >= 90
                    ? 'bg-rose-400'
                    : tokenQuota.freetts.percent >= 70
                      ? 'bg-amber-400'
                      : 'bg-sky-400',
              },
            ].map((item) => (
              <div
                key={item.name}
                title={`Sisa: ${formatTokenNumber(item.q.remaining)} token`}
                className="flex items-center gap-1.5 text-dark-300"
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.dot}`} />
                <span className="font-sans font-medium text-dark-200">{item.name}</span>
                <span className="font-bold text-white">{item.q.percent}%</span>
                <span className="text-[10px] text-dark-400">
                  ({formatTokenNumber(item.q.used)}/{formatTokenNumber(item.q.limit)})
                </span>
              </div>
            ))}
          </div>

          {/* VOICEVOX Status & Speaker Picker (only when VOICEVOX is selected) */}
          {ttsEngine === 'voicevox' && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-[12px] animate-fadeIn">
              {vvStatus.online ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-semibold shrink-0">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Aktif ({vvStatus.speakers.length} suara)
                  </span>
                  <select
                    value={vvSpeakerId ?? ''}
                    onChange={(e) => setVvSpeakerId(e.target.value === '' ? undefined : Number(e.target.value))}
                    className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] text-white"
                  >
                    <option value="">Ikuti karakter ({selectedVoice.name})</option>
                    {vvStatus.speakers.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.id} · {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-200 text-[11.5px]">
                    VOICEVOX lokal belum aktif. Jalankan <b>VoiceLab.command</b> di Desktop.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      haptic(6);
                      checkVoicevox();
                      toast('Mengecek VOICEVOX…', 'info');
                    }}
                    className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-white/20"
                  >
                    Cek Ulang
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Quick Category & Character Bar (Clean single-row navigation) */}
        <div className="px-3 py-2 bg-white/[0.015] space-y-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'Indonesian', flag: '🇮🇩', label: 'Indonesia' },
              { id: 'Anime JP', flag: '🎌', label: 'Anime JP' },
              { id: 'ElevenLabs', flag: '🎙️', label: 'ElevenLabs' },
              { id: 'American', flag: '🇺🇸', label: 'English' },
              { id: 'Indonesian (Jawa)', flag: '🇮🇩', label: 'Jawa' },
              { id: 'Indonesian (Sunda)', flag: '🇮🇩', label: 'Sunda' },
            ].map((acc) => {
              const isActive = selectedVoice.accent === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelectAccentCategory(acc.id)}
                  className={`flex shrink-0 h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium transition-all active:scale-95 ${
                    isActive
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.05] text-dark-300 hover:text-white'
                  }`}
                >
                  <span>{acc.flag}</span>
                  <span>{acc.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onOpenVoiceSelector}
              className="flex shrink-0 h-7 items-center gap-1 rounded-full bg-white/[0.04] px-2.5 text-[11.5px] font-medium text-dark-300 hover:text-white"
            >
              Semua…
            </button>
          </div>

          {(isAnimeMode || isElevenMode) && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 animate-fadeIn">
              {(isElevenMode ? elevenVoices : animeVoices).map((v) => {
                const active = selectedVoice.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      haptic(6);
                      onSelectVoice(v);
                    }}
                    className={`flex shrink-0 h-7 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[11.5px] font-semibold transition-all active:scale-95 ${
                      active
                        ? 'bg-pink-500/25 ring-1 ring-pink-400 text-white'
                        : 'bg-white/[0.04] text-dark-300 hover:text-white'
                    }`}
                  >
                    <img src={v.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                    <span>{v.name.replace(/ \(.+\)$/, '')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Main Script Editor */}
        <div>
          <textarea
            rows={5}
            placeholder="Tulis atau tempel naskah di sini…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="block w-full min-h-[130px] sm:min-h-[150px] bg-transparent px-3.5 py-3 text-[15px] text-white placeholder-dark-500 focus:outline-none resize-none leading-relaxed"
          />

          {/* Collapsible Preset Dialogues (only when opened) */}
          {showExtras === 'anime' && isAnimeMode && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 pb-2.5 animate-fadeIn">
              {ANIME_GAME_LINES.map((line) => (
                <button
                  key={line.label}
                  type="button"
                  onClick={() => {
                    haptic(6);
                    setText(line.text);
                    setShowExtras('none');
                  }}
                  className="shrink-0 h-7 rounded-full bg-pink-500/15 px-3 text-[11.5px] font-medium text-pink-200 hover:bg-pink-500/25"
                >
                  {line.label}
                </button>
              ))}
            </div>
          )}

          {/* Auto accent mismatch helper */}
          {isIndoTextWithForeignVoice && (
            <div className="mx-3 mb-2.5 flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-[12px] text-amber-200">
              <span className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                Naskah Indonesia — ganti ke suara ID?
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    const ardi = voices.find((v) => v.id === 'voice-ardi');
                    if (ardi) onSelectVoice(ardi);
                  }}
                  className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-black"
                >
                  Ardi
                </button>
                <button
                  onClick={() => {
                    const gadis = voices.find((v) => v.id === 'voice-gadis');
                    if (gadis) onSelectVoice(gadis);
                  }}
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white"
                >
                  Gadis
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mx-3 mb-2.5 flex items-center justify-between gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-[12px] text-rose-200">
              <span className="min-w-0">⚠️ {errorMsg}</span>
              <button
                onClick={handleGenerate}
                className="shrink-0 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                Ulangi
              </button>
            </div>
          )}
        </div>

        {/* 4. Bottom Action Bar (Clean & Uncluttered) */}
        <div className="flex items-center justify-between gap-2 p-2.5 bg-white/[0.01]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowProsodyPopover(true)}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] px-3 text-[12px] font-medium text-dark-200 hover:text-white transition-colors"
              title="Atur kecepatan & nada suara"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{settings.speed.toFixed(1)}x</span>
            </button>

            {isAnimeMode ? (
              <button
                type="button"
                onClick={() => setShowExtras(showExtras === 'anime' ? 'none' : 'anime')}
                className={`flex h-10 items-center gap-1 rounded-xl px-3 text-[12px] font-medium transition-colors ${
                  showExtras === 'anime'
                    ? 'bg-pink-500 text-white'
                    : 'bg-white/[0.05] text-dark-200 hover:text-white'
                }`}
              >
                <span>Contoh Dialog</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsTemplateOpen(true)}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] px-3 text-[12px] font-medium text-dark-200 hover:text-white transition-colors"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                <span>Template</span>
              </button>
            )}

            {text.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setText('');
                  toast('Naskah dibersihkan', 'info');
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-dark-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                title="Bersihkan Naskah"
                aria-label="Bersihkan Naskah"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {isGenerating ? (
            <button
              type="button"
              onClick={handleAbortGeneration}
              className="flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-[13.5px] font-bold text-rose-200 active:scale-[0.98] transition-transform"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Batal</span>
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={text.trim().length === 0}
              className="flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-white text-[13.5px] font-bold text-zinc-950 shadow-sm hover:bg-zinc-100 transition-all disabled:opacity-30 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4 fill-zinc-950" />
              <span>Generate Suara</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= RESULT CARD ================= */}
      {lastGen && (
        <div className="studio-card rounded-3xl p-3 sm:p-4 space-y-3 animate-fadeIn">
          {fallbackNotice && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-[12px] text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{fallbackNotice}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-1">
            <img src={lastGen.voiceAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-white">{lastGen.voiceName}</div>
              <div className="truncate text-[12px] text-dark-400">
                Siap dipakai · {lastGen.duration} detik · {lastGen.model}
              </div>
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
