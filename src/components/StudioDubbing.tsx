'use client';

import React, { useState } from 'react';
import { Voice, Generation, StudioBlock, DubbingProject } from '@/lib/types';
import {
  Film,
  Plus,
  Trash2,
  Sparkles,
  Wand2,
  Globe,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Languages,
  Download,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';

interface StudioDubbingProps {
  voices: Voice[];
  onGenerationCreated: (gen: Generation) => void;
}

const TARGET_LANGUAGES = [
  'English (US)',
  'Indonesian',
  'Japanese',
  'Korean',
  'Spanish',
  'French',
  'German',
  'Arabic',
  'Chinese (Mandarin)',
  'Hindi',
];

export default function StudioDubbing({ voices, onGenerationCreated }: StudioDubbingProps) {
  const [studioMode, setStudioMode] = useState<'multitrack' | 'localization'>('multitrack');
  const [projectTitle, setProjectTitle] = useState('Podcast Episode #1: Revolusi Suara AI');
  const [blocks, setBlocks] = useState<StudioBlock[]>([
    {
      id: 'b1',
      characterName: 'Host (Ardi)',
      voiceId: voices.find((v) => v.id === 'voice-ardi')?.id || voices[0]?.id,
      text: 'Selamat datang di podcast masa depan teknologi bersama Voice Lab.',
      pauseAfterMs: 400,
    },
    {
      id: 'b2',
      characterName: 'Guest (Gadis)',
      voiceId: voices.find((v) => v.id === 'voice-gadis')?.id || voices[1]?.id,
      text: 'Terima kasih telah mengundang saya! Sangat luar biasa melihat kualitas suara neural yang berjalan langsung di PC ini.',
      pauseAfterMs: 400,
    },
  ]);

  const [isRendering, setIsRendering] = useState(false);
  const [masterGeneration, setMasterGeneration] = useState<Generation | null>(null);

  // Localization / Cross-language Dubbing state
  const [sourceLang, setSourceLang] = useState('Indonesian');
  const [targetLang, setTargetLang] = useState('English (US)');
  const [sourceText, setSourceText] = useState(
    'Selamat datang di platform suara masa depan yang berjalan langsung di komputer Anda.'
  );
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [dubVoiceId, setDubVoiceId] = useState(
    voices.find((v) => v.id === 'voice-adam')?.id || voices[0]?.id
  );
  const [isDubbing, setIsDubbing] = useState(false);
  const [dubResult, setDubResult] = useState<DubbingProject | null>(null);
  const [showSrtPreview, setShowSrtPreview] = useState(false);

  const addBlock = () => {
    const newBlock: StudioBlock = {
      id: `b-${Date.now()}`,
      characterName: `Speaker ${blocks.length + 1}`,
      voiceId: voices[blocks.length % voices.length]?.id || voices[0]?.id,
      text: '',
      pauseAfterMs: 400,
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return;
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const updateBlock = (id: string, updates: Partial<StudioBlock>) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleGenerateStudio = async () => {
    const validBlocks = blocks.filter((b) => b.text.trim().length > 0);
    if (validBlocks.length === 0) return;

    setIsRendering(true);
    try {
      const res = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle,
          blocks: validBlocks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.blocks) {
        setBlocks(data.blocks);
      }
      setMasterGeneration(data.generation);
      onGenerationCreated(data.generation);
    } catch (err: any) {
      alert('Gagal me-render studio: ' + err.message);
    } finally {
      setIsRendering(false);
    }
  };

  const handleTargetLangChange = async (lang: string) => {
    setTargetLang(lang);
    const matchVoice = voices.find((v) =>
      v.language.toLowerCase().includes(lang.toLowerCase().split(' ')[0])
    );
    if (matchVoice) {
      setDubVoiceId(matchVoice.id);
    }
    if (sourceText.trim()) {
      handleAutoTranslate(sourceText, lang);
    }
  };

  const handleAutoTranslate = async (textToTranslate = sourceText, lang = targetLang) => {
    if (!textToTranslate.trim()) return;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/dubbing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'translate_only',
          sourceText: textToTranslate,
          targetLanguage: lang,
        }),
      });
      const data = await res.json();
      if (data.translatedText) {
        setTranslatedText(data.translatedText);
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRunDubbing = async () => {
    if (!sourceText.trim()) return;
    setIsDubbing(true);
    try {
      const res = await fetch('/api/dubbing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Global Video Localization',
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          sourceText,
          translatedText,
          voiceId: dubVoiceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDubResult(data.dubbing);
      setTranslatedText(data.dubbing.translatedText);
      onGenerationCreated(data.generation);
    } catch (e: any) {
      alert('Dubbing error: ' + e.message);
    } finally {
      setIsDubbing(false);
    }
  };

  const downloadSrtFile = (srt: string, name: string) => {
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllStems = () => {
    const blocksWithAudio = blocks.filter((b) => b.audioUrl);
    blocksWithAudio.forEach((b, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = b.audioUrl!;
        a.download = `${b.characterName.replace(/\s+/g, '-')}-stem-${i + 1}.mp3`;
        a.click();
      }, i * 250);
    });
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Compact Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Studio & AI Dubbing</h1>
          <TooltipInfo
            title="Multi-Track & Dubbing"
            text="Susun dialog banyak pembicara menjadi satu Master MP3, atau terjemahkan & sulih suara naskah ke 10+ bahasa lengkap dengan subtitle .SRT."
            position="right"
          />
        </div>

        <div className="flex rounded-xl bg-dark-900 p-1 border border-white/10">
          <button
            onClick={() => setStudioMode('multitrack')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              studioMode === 'multitrack'
                ? 'bg-amber-500 text-black shadow'
                : 'text-dark-300 hover:text-white'
            }`}
          >
            Multi-Speaker Dialog
          </button>
          <button
            onClick={() => setStudioMode('localization')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
              studioMode === 'localization'
                ? 'bg-amber-500 text-black shadow'
                : 'text-dark-300 hover:text-white'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            AI Dubbing & SRT
          </button>
        </div>
      </div>

      {studioMode === 'multitrack' ? (
        <>
          <div className="studio-card rounded-2xl p-4 flex items-center justify-between gap-4">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Judul Episode Studio..."
              className="flex-1 rounded-xl bg-dark-850 border border-white/10 px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            />
            <span className="text-xs text-dark-300 shrink-0 font-mono">
              {blocks.length} Baris Dialog
            </span>
          </div>

          <div className="space-y-3">
            {blocks.map((block, index) => {
              const currentVoice = voices.find((v) => v.id === block.voiceId) || voices[0];
              return (
                <div
                  key={block.id}
                  className="studio-card rounded-2xl p-4 space-y-3 hover:border-white/20 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={block.characterName}
                        onChange={(e) =>
                          updateBlock(block.id, { characterName: e.target.value })
                        }
                        className="rounded-lg bg-dark-850 border border-white/10 px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-amber-500 w-36"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <img
                        src={currentVoice?.avatarUrl}
                        alt={currentVoice?.name}
                        className="h-6 w-6 rounded-full object-cover border border-white/15"
                      />
                      <select
                        value={block.voiceId}
                        onChange={(e) => updateBlock(block.id, { voiceId: e.target.value })}
                        className="rounded-lg bg-dark-850 border border-white/10 px-2.5 py-1 text-xs font-semibold text-white focus:outline-none"
                      >
                        {voices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.accent})
                          </option>
                        ))}
                      </select>

                      {blocks.length > 1 && (
                        <button
                          onClick={() => removeBlock(block.id)}
                          className="p-1.5 rounded-lg text-dark-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Hapus baris"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    placeholder={`Dialog ${block.characterName}...`}
                    value={block.text}
                    onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                    className="w-full rounded-xl bg-dark-950/60 border border-white/10 p-3 text-sm text-white placeholder-dark-400 focus:border-amber-500 focus:outline-none resize-none"
                  />

                  {block.audioUrl && (
                    <AudioWaveVisualizer
                      audioUrl={block.audioUrl}
                      duration={block.duration}
                      compact
                      fileName={`${block.characterName}-line-${index + 1}.mp3`}
                    />
                  )}
                </div>
              );
            })}

            <button
              onClick={addBlock}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-dark-900/50 py-2.5 text-xs font-semibold text-dark-300 hover:text-white hover:border-amber-500/50 transition-all"
            >
              <Plus className="h-4 w-4" />
              Tambah Pembicara
            </button>
          </div>

          <button
            onClick={handleGenerateStudio}
            disabled={isRendering}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            {isRendering ? 'Menggabungkan Master Track...' : 'Render Master Track Multi-Speaker'}
          </button>

          {masterGeneration && (
            <div className="studio-card rounded-2xl border-amber-500/40 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Master Multi-Speaker Audio ({blocks.length} Karakter)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadAllStems}
                    className="flex items-center gap-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-white/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:text-white transition-colors"
                    title="Unduh seluruh track vokal masing-masing pembicara secara terpisah"
                  >
                    <Download className="h-3 w-3" />
                    Unduh Stems ({blocks.filter((b) => b.audioUrl).length} Track)
                  </button>
                  <span className="text-xs text-dark-300 font-mono">
                    {masterGeneration.duration}s
                  </span>
                </div>
              </div>
              <AudioWaveVisualizer
                audioUrl={masterGeneration.audioUrl}
                duration={masterGeneration.duration}
                autoPlay
                fileName={`${projectTitle.replace(/\s+/g, '-')}-master.mp3`}
              />
            </div>
          )}
        </>
      ) : (
        /* AI Dubbing & Auto-Translation Studio */
        <div className="space-y-5">
          <div className="studio-card rounded-2xl p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Bahasa Asli
                </label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full rounded-xl bg-dark-850 border border-white/10 px-3 py-2.5 text-xs font-semibold text-white"
                >
                  {TARGET_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={() => handleAutoTranslate()}
                  disabled={isTranslating}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition-all"
                  title="Terjemahkan otomatis ke bahasa target"
                >
                  <Languages className="h-4 w-4" />
                  {isTranslating ? 'Menerjemahkan...' : 'Terjemahkan Otomatis →'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Bahasa Target Dubbing
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => handleTargetLangChange(e.target.value)}
                  className="w-full rounded-xl bg-dark-850 border border-amber-500/40 px-3 py-2.5 text-xs font-semibold text-white"
                >
                  {TARGET_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Naskah Sumber ({sourceLang})
                </label>
                <textarea
                  rows={4}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Ketik naskah dalam bahasa sumber..."
                  className="w-full rounded-xl bg-dark-950/60 border border-white/10 p-3.5 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-dark-200">
                    Hasil Terjemahan ({targetLang})
                  </label>
                  <TooltipInfo
                    text="Klik 'Terjemahkan Otomatis' atau langsung klik Generate Dubbing—sistem akan menerjemahkan kalimat Anda secara otomatis."
                    position="left"
                  />
                </div>
                <textarea
                  rows={4}
                  value={translatedText}
                  onChange={(e) => setTranslatedText(e.target.value)}
                  placeholder="Otomatis diterjemahkan saat Anda klik tombol Terjemahkan atau Generate..."
                  className="w-full rounded-xl bg-dark-950/60 border border-white/10 p-3.5 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2.5 flex-1">
                <span className="text-xs font-semibold text-dark-300 shrink-0">Aktor Suara:</span>
                <select
                  value={dubVoiceId}
                  onChange={(e) => setDubVoiceId(e.target.value)}
                  className="flex-1 rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs font-semibold text-white"
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — Aksen {v.accent} ({v.language})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleRunDubbing}
                disabled={isDubbing || !sourceText.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-50"
              >
                <Globe className="h-4 w-4" />
                {isDubbing ? 'Menyulih Suara...' : 'Generate Dubbing & SRT'}
              </button>
            </div>
          </div>

          {dubResult && dubResult.audioUrl && (
            <div className="studio-card rounded-2xl border-amber-500/40 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Dubbing Selesai ({dubResult.sourceLanguage} → {dubResult.targetLanguage})
                </span>

                <div className="flex items-center gap-2">
                  {dubResult.srtContent && (
                    <>
                      <button
                        onClick={() => setShowSrtPreview(!showSrtPreview)}
                        className="flex items-center gap-1 rounded-lg bg-dark-850 border border-white/10 px-2.5 py-1.5 text-xs text-dark-200 hover:text-white"
                      >
                        {showSrtPreview ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        {showSrtPreview ? 'Sembunyikan SRT' : 'Lihat Teks SRT'}
                      </button>

                      <button
                        onClick={() => downloadSrtFile(dubResult.srtContent!, dubResult.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Download .SRT
                      </button>
                    </>
                  )}
                </div>
              </div>

              <AudioWaveVisualizer
                audioUrl={dubResult.audioUrl}
                duration={dubResult.duration}
                autoPlay
                fileName={`dubbing-${dubResult.targetLanguage}-${dubResult.id}.mp3`}
              />

              {/* Progressive Disclosure: SRT text only shown when user clicks "Lihat Teks SRT" */}
              {showSrtPreview && dubResult.srtContent && (
                <div className="rounded-xl bg-dark-950/90 p-3.5 border border-white/10 animate-in fade-in duration-150">
                  <pre className="text-xs font-mono text-dark-200 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {dubResult.srtContent}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
