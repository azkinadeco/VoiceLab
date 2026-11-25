'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/types';
import { X, HardDrive, Key, Sliders, Check, Folder, Info, Moon, RotateCcw } from 'lucide-react';
import { EngineBadgeIcon } from './CustomIcons';
import { toast } from '@/lib/toast';
import {
  computeTokenQuota,
  resetTokenQuota,
  formatTokenNumber,
  syncLiveElevenQuota,
  TokenQuotaSnapshot,
} from '@/lib/token-quota';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSettingsSaved }: SettingsModalProps) {
  const [provider, setProvider] = useState<'edge-neural' | 'gemini-tts' | 'freetts-api' | 'elevenlabs-api' | 'openai-api'>('edge-neural');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [freeTtsApiKey, setFreeTtsApiKey] = useState('');
  const [elevenApiKey, setElevenApiKey] = useState('');
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [envConfigured, setEnvConfigured] = useState<{ gemini?: boolean; freetts?: boolean; elevenlabs?: boolean }>({});
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'wav'>('mp3');
  const [isOled, setIsOled] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [tokenQuota, setTokenQuota] = useState<TokenQuotaSnapshot>(() => computeTokenQuota([]));

  const refreshQuota = () => {
    syncLiveElevenQuota().finally(() => {
      fetch('/api/history')
        .then((r) => r.json())
        .then((d) => setTokenQuota(computeTokenQuota(Array.isArray(d.generations) ? d.generations : [])))
        .catch(() => setTokenQuota(computeTokenQuota([])));
    });
  };

  const handleClearCache = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh riwayat audio lama untuk mengosongkan hard disk PC Anda?')) {
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_generations' }),
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        if (onSettingsSaved) onSettingsSaved();
        toast(`Berhasil membebaskan ruang disk. ${data.removedCount} file audio berhasil dibersihkan.`);
      }
    } catch {
      toast('Gagal membersihkan cache storage.', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsOled(localStorage.getItem('voicelab_oled') === 'true');
      refreshQuota();
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => {
          let localKeys: any = {};
          try {
            localKeys = JSON.parse(localStorage.getItem('voicelab_client_keys') || '{}');
          } catch {}
          if (data.settings) {
            setProvider(data.settings.ttsProvider || localKeys.ttsProvider || 'edge-neural');
            setGeminiApiKey(data.settings.geminiApiKey || localKeys.geminiApiKey || '');
            setFreeTtsApiKey(data.settings.freeTtsApiKey || localKeys.freeTtsApiKey || '');
            setElevenApiKey(data.settings.elevenLabsApiKey || localKeys.elevenLabsApiKey || '');
            setOpenAiApiKey(data.settings.openAiApiKey || localKeys.openAiApiKey || '');
            setAudioFormat(data.settings.audioFormat || 'mp3');
          }
          if (data.envConfigured) {
            setEnvConfigured(data.envConfigured);
          }
          if (data.stats) {
            setStats(data.stats);
          }
        })
        .catch((e) => console.error(e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Persist keys in browser localStorage so they survive Vercel serverless cold starts
      try {
        localStorage.setItem(
          'voicelab_client_keys',
          JSON.stringify({
            ttsProvider: provider,
            geminiApiKey: geminiApiKey.trim(),
            freeTtsApiKey: freeTtsApiKey.trim(),
            elevenLabsApiKey: elevenApiKey.trim(),
            openAiApiKey: openAiApiKey.trim(),
          })
        );
      } catch {}

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ttsProvider: provider,
          geminiApiKey: geminiApiKey.trim(),
          freeTtsApiKey: freeTtsApiKey.trim(),
          elevenLabsApiKey: elevenApiKey.trim(),
          openAiApiKey: openAiApiKey.trim(),
          audioFormat,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        refreshQuota();
        toast('Pengaturan berhasil disimpan');
        if (onSettingsSaved) onSettingsSaved();
      }
    } catch (e) {
      toast('Gagal menyimpan pengaturan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="m-sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="m-sheet relative flex flex-col w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl bg-dark-900 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Sliders className="h-5 w-5 shrink-0 text-brand-400" />
            <h2 className="truncate text-base sm:text-lg font-bold sm:font-semibold text-white">Pengaturan & Penyimpanan PC</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dark-400 hover:bg-dark-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 sm:max-h-[70vh]">
          {/* API Token Limit & Quota Section (Gemini TTS & FreeTTS) */}
          <div className="rounded-xl bg-dark-950 p-4 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Key className="h-4 w-4 text-emerald-400" />
                Kuota & Limit Token TTS (Gemini & FreeTTS)
              </span>
              <button
                type="button"
                onClick={() => {
                  resetTokenQuota('all');
                  refreshQuota();
                  toast('Hitungan kuota token di-reset');
                }}
                className="flex items-center gap-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1 text-[11px] font-medium text-dark-200 hover:text-white transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Token
              </button>
            </div>

            {/* Compact 3-Column Quota Summary (Gemini, ElevenLabs, FreeTTS) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {[
                { engine: 'gemini' as const, label: 'Gemini', q: tokenQuota.gemini, bar: 'bg-emerald-400' },
                { engine: 'elevenlabs' as const, label: 'ElevenLabs', q: tokenQuota.elevenlabs, bar: 'bg-violet-400' },
                { engine: 'freetts' as const, label: 'FreeTTS', q: tokenQuota.freetts, bar: 'bg-sky-400' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 font-semibold text-white">
                      <EngineBadgeIcon engine={item.engine} className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    <span className="font-mono font-bold text-white">{item.q.percent}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.q.percent >= 90 ? 'bg-rose-500' : item.bar}`}
                      style={{ width: `${Math.max(3, item.q.percent)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] font-mono text-dark-300">
                    <span>
                      {formatTokenNumber(item.q.used)} / {formatTokenNumber(item.q.limit)}
                    </span>
                    <span>Sisa {formatTokenNumber(item.q.remaining)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Storage on PC Section */}
          <div className="rounded-xl bg-dark-950 p-4 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <HardDrive className="h-4 w-4 text-brand-400" />
                Status Penyimpanan PC Lokal
              </span>
              <span className="text-xs font-mono text-brand-300">
                {stats?.diskUsageFormatted || '0 MB'} terpakai
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-dark-300 pt-2 border-t border-white/5">
              <div>
                <p className="text-[11px] text-dark-400">Total File Generasi</p>
                <p className="font-semibold text-white mt-0.5">{stats?.totalGenerations ?? 0} file audio</p>
              </div>
              <div>
                <p className="text-[11px] text-dark-400">Total Suara Terdaftar</p>
                <p className="font-semibold text-white mt-0.5">{stats?.totalVoices ?? 0} suara</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 text-[11px] text-dark-400 pt-1 font-mono">
              <span className="flex items-center gap-1.5 truncate">
                <Folder className="h-3.5 w-3.5 text-dark-400 shrink-0" />
                <span className="truncate">{stats?.storagePath || 'data/'}</span>
              </span>
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearing}
                className="rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-2 sm:py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 shrink-0"
              >
                {isClearing ? 'Membersihkan...' : 'Kosongkan Cache Audio'}
              </button>
            </div>
          </div>

          {/* OLED Theme Toggle */}
          <div className="rounded-xl bg-dark-950 p-4 border border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Moon className="h-4 w-4 text-amber-400" />
              <div>
                <p className="text-xs font-semibold text-white">Mode Layar OLED Pure Black</p>
                <p className="text-[11px] text-dark-400">
                  Latar belakang murni #000000 untuk kontras maksimal & hemat baterai OLED
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !isOled;
                setIsOled(next);
                localStorage.setItem('voicelab_oled', String(next));
                if (next) document.body.classList.add('oled-black');
                else document.body.classList.remove('oled-black');
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isOled ? 'bg-amber-500' : 'bg-dark-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isOled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Engine Provider */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-white">TTS Synthesis Engine</label>

            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 rounded-xl p-3.5 border cursor-pointer transition-colors ${
                  provider === 'edge-neural'
                    ? 'border-brand-500 bg-brand-950/20'
                    : 'border-white/5 bg-dark-950/60 hover:bg-dark-850'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="edge-neural"
                  checked={provider === 'edge-neural'}
                  onChange={() => setProvider('edge-neural')}
                  className="mt-0.5 accent-brand-500"
                />
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                    Neural Turbo Engine (Bawaan • Gratis)
                    <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[10px]">
                      Recommended
                    </span>
                  </h4>
                  <p className="text-[11px] text-dark-400 mt-0.5">
                    Kualitas suara sangat natural setara ElevenLabs tanpa perlu API key, tanpa kuota batas.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 rounded-xl p-3.5 border cursor-pointer transition-colors ${
                  provider === 'gemini-tts'
                    ? 'border-brand-500 bg-brand-950/20'
                    : 'border-white/5 bg-dark-950/60 hover:bg-dark-850'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="gemini-tts"
                  checked={provider === 'gemini-tts'}
                  onChange={() => setProvider('gemini-tts')}
                  className="mt-0.5 accent-brand-500"
                />
                <div className="w-full">
                  <h4 className="text-xs font-semibold text-white flex flex-wrap items-center gap-2">
                    ✨ Gemini 2.5 Flash TTS (Google AI Studio)
                    {envConfigured.gemini ? (
                      <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px]">
                        ✓ Aktif dari Server Env
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px]">
                        Paling Natural • Tanpa Watermark
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-dark-400 mt-0.5">
                    Suara AI paling ekspresif & natural resmi dari Google. Gratis (Free Tier) di{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-300 underline"
                    >
                      aistudio.google.com/apikey
                    </a>
                    . Otomatis fallback ke FreeTTS jika limit.
                  </p>
                  <div className="mt-2.5">
                    <input
                      type="password"
                      placeholder="Gemini API Key (AIza... atau set GEMINI_API_KEY di Vercel)"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="w-full rounded-lg bg-dark-900 border border-white/10 px-3 py-2.5 sm:py-1.5 text-base sm:text-xs text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 rounded-xl p-3.5 border cursor-pointer transition-colors ${
                  provider === 'freetts-api'
                    ? 'border-brand-500 bg-brand-950/20'
                    : 'border-white/5 bg-dark-950/60 hover:bg-dark-850'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="freetts-api"
                  checked={provider === 'freetts-api'}
                  onChange={() => setProvider('freetts-api')}
                  className="mt-0.5 accent-brand-500"
                />
                <div className="w-full">
                  <h4 className="text-xs font-semibold text-white flex flex-wrap items-center gap-2">
                    FreeTTS Neural API (Terbaik untuk Vercel • Gratis)
                    {envConfigured.freetts ? (
                      <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px]">
                        ✓ Aktif dari Server Env
                      </span>
                    ) : (
                      <span className="rounded bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 text-[10px]">
                        2.250+ Suara
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-dark-400 mt-0.5">
                    Suara neural jernih (Ardi, Gadis, Jawa, Sunda, dll.) via REST API freetts.org. Ambil API key gratis di{' '}
                    <a
                      href="https://freetts.org/developers"
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-300 underline"
                    >
                      freetts.org/developers
                    </a>
                    .
                  </p>
                  <div className="mt-2.5">
                    <input
                      type="password"
                      placeholder="FreeTTS x-api-key (atau set FREETTS_API_KEY di Vercel)"
                      value={freeTtsApiKey}
                      onChange={(e) => setFreeTtsApiKey(e.target.value)}
                      className="w-full rounded-lg bg-dark-900 border border-white/10 px-3 py-2.5 sm:py-1.5 text-base sm:text-xs text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 rounded-xl p-3.5 border cursor-pointer transition-colors ${
                  provider === 'elevenlabs-api'
                    ? 'border-brand-500 bg-brand-950/20'
                    : 'border-white/5 bg-dark-950/60 hover:bg-dark-850'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="elevenlabs-api"
                  checked={provider === 'elevenlabs-api'}
                  onChange={() => setProvider('elevenlabs-api')}
                  className="mt-0.5 accent-brand-500"
                />
                <div className="w-full">
                  <h4 className="text-xs font-semibold text-white flex flex-wrap items-center gap-2">
                    Official ElevenLabs API (Multilingual v2 • 12 Karakter Gratis)
                    {envConfigured.elevenlabs ? (
                      <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px]">
                        ✓ Aktif dari Server Env
                      </span>
                    ) : (
                      <span className="rounded bg-violet-500/20 text-violet-300 px-1.5 py-0.5 text-[10px]">
                        Anime & Karakter Ekspresif
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-dark-400 mt-0.5">
                    Suara karakter gratis ElevenLabs (Gigi, Mimi, Jessica, Charlotte, Lily, Sarah, Brian, dll.) + sinkronisasi sisa kuota otomatis.
                  </p>
                  <div className="mt-2.5">
                    <input
                      type="password"
                      placeholder="ElevenLabs xi-api-key (cth: sk_... atau set ELEVENLABS_API_KEY di Vercel)"
                      value={elevenApiKey}
                      onChange={(e) => setElevenApiKey(e.target.value)}
                      className="w-full rounded-lg bg-dark-900 border border-white/10 px-3 py-2.5 sm:py-1.5 text-base sm:text-xs text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 px-4 sm:px-6 py-3 sm:py-4 bg-dark-950/60">
          <div className="hidden sm:flex text-xs text-emerald-400 items-center gap-1.5">
            {saveSuccess && (
              <>
                <Check className="h-4 w-4" />
                Pengaturan berhasil disimpan!
              </>
            )}
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none h-12 sm:h-auto rounded-2xl sm:rounded-lg bg-dark-800 px-3.5 py-2 text-sm sm:text-xs font-medium text-dark-300 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-none h-12 sm:h-auto rounded-2xl sm:rounded-lg bg-brand-500 px-4 py-2 text-sm sm:text-xs font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-400 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
