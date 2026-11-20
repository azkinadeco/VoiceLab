'use client';

import React, { useState, useEffect } from 'react';
import { PronunciationRule } from '@/lib/types';
import { BookOpen, Plus, Trash2, Check, X, Sparkles, Volume2 } from 'lucide-react';

interface PronunciationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PronunciationModal({ isOpen, onClose }: PronunciationModalProps) {
  const [rules, setRules] = useState<PronunciationRule[]>([]);
  const [word, setWord] = useState('');
  const [replacement, setReplacement] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [language, setLanguage] = useState('All');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [testText, setTestText] = useState('Selamat datang di ElevenLabs AI untuk UMKM Indonesia.');

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  const loadRules = async () => {
    try {
      const res = await fetch('/api/pronunciation');
      const data = await res.json();
      if (data.rules) setRules(data.rules);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const handleAddRule = async () => {
    if (!word.trim() || !replacement.trim()) return;
    try {
      const res = await fetch('/api/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: word.trim(),
          replacement: replacement.trim(),
          phonetic: phonetic.trim(),
          language,
          caseSensitive,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (data.rule) {
        setRules([data.rule, ...rules]);
        setWord('');
        setReplacement('');
        setPhonetic('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleRule = async (rule: PronunciationRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    setRules(rules.map((r) => (r.id === rule.id ? updated : r)));
    await fetch('/api/pronunciation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const handleDeleteRule = async (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
    await fetch(`/api/pronunciation?id=${id}`, { method: 'DELETE' });
  };

  // Preview transformed text
  const previewTransformed = (() => {
    let out = testText;
    for (const r of rules.filter((x) => x.enabled)) {
      if (!r.word.trim()) continue;
      const escaped = r.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, r.caseSensitive ? 'g' : 'gi');
      out = out.replace(regex, r.replacement);
    }
    return out;
  })();

  return (
    <div
      className="m-sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="m-sheet relative flex flex-col w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-dark-900 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white">
                <span className="sm:hidden">Kamus Pelafalan</span>
                <span className="hidden sm:inline">Pronunciation Dictionary & Phoneme Rules</span>
              </h2>
              <p className="text-xs text-dark-400 line-clamp-2 sm:line-clamp-none">
                Atur cara pelafalan singkatan, nama brand, istilah teknis, atau fonetik khusus secara otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dark-400 hover:bg-dark-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Add New Rule Form */}
          <div className="rounded-xl bg-dark-950 p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-white">Tambah Aturan Pelafalan Baru</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                placeholder="Kata asli (cth: UMKM)"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="rounded-lg bg-dark-850 border border-white/10 px-3 py-2.5 sm:py-2 text-base sm:text-xs text-white placeholder-dark-500 focus:border-brand-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Pelafalan (cth: U M K M)"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                className="rounded-lg bg-dark-850 border border-white/10 px-3 py-2.5 sm:py-2 text-base sm:text-xs text-white placeholder-dark-500 focus:border-brand-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Fonetik IPA (opsional)"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                className="rounded-lg bg-dark-850 border border-white/10 px-3 py-2.5 sm:py-2 text-base sm:text-xs text-white placeholder-dark-500 focus:border-brand-500 focus:outline-none"
              />
              <button
                onClick={handleAddRule}
                disabled={!word.trim() || !replacement.trim()}
                className="flex h-11 sm:h-auto items-center justify-center gap-1.5 rounded-2xl sm:rounded-lg bg-brand-500 px-3 py-2 text-sm sm:text-xs font-semibold text-white hover:bg-brand-400 disabled:opacity-40 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Tambah Rule
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-dark-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="accent-brand-500"
                />
                <span>Case Sensitive (Huruf Besar/Kecil)</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded bg-dark-850 border border-white/10 px-2 py-1 text-xs text-dark-200"
              >
                <option value="All">Semua Bahasa</option>
                <option value="Indonesian">Indonesian</option>
                <option value="English">English</option>
              </select>
            </div>
          </div>

          {/* Live Phoneme Transformer Sandbox */}
          <div className="rounded-xl bg-dark-850/60 border border-brand-500/20 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-semibold text-brand-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Live Pelafalan Sandbox
              </span>
              <span className="text-[11px] text-dark-400">Otomatis diterapkan saat sintesis TTS</span>
            </div>
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full rounded-lg bg-dark-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none"
            />
            <div className="rounded-lg bg-dark-950/80 p-2.5 text-xs text-emerald-300 font-mono">
              Output Sintesis: &ldquo;{previewTransformed}&rdquo;
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-dark-300">
              Daftar Kamus Pelafalan Aktif ({rules.length})
            </h4>
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-dark-850 border border-white/5 px-3 sm:px-4 py-3 text-xs"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggleRule(rule)}
                    className="accent-brand-500 h-4 w-4 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 break-all">
                      <span className="font-semibold text-white">{rule.word}</span>
                      <span className="text-dark-500">→</span>
                      <span className="font-semibold text-brand-300">{rule.replacement}</span>
                      {rule.phonetic && (
                        <span className="rounded bg-dark-750 px-1.5 py-0.5 text-[10px] font-mono text-dark-300">
                          /{rule.phonetic}/
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-dark-400">
                      Bahasa: {rule.language} • {rule.caseSensitive ? 'Case-sensitive' : 'Case-insensitive'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  aria-label="Hapus aturan"
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-dark-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-white/10 px-4 sm:px-6 py-3 sm:py-3.5 bg-dark-950/60">
          <button
            onClick={onClose}
            className="w-full sm:w-auto h-12 sm:h-auto rounded-2xl sm:rounded-lg bg-brand-500 px-4 py-1.5 text-sm sm:text-xs font-semibold text-white hover:bg-brand-400"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
