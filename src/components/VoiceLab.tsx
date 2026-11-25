'use client';

import React, { useState, useRef } from 'react';
import { Voice } from '@/lib/types';
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  Trash2,
  Check,
  Sliders,
  AlertCircle,
  Activity,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import TooltipInfo from './TooltipInfo';
import PageHeader from './PageHeader';
import { haptic } from '@/lib/haptics';
import { analyzeVoiceSampleAcoustics } from '@/lib/audio-dsp';

interface VoiceLabProps {
  customVoices: Voice[];
  onVoiceCreated: (voice: Voice) => void;
  onVoiceDeleted: (id: string) => void;
  onSelectForTTS: (voice: Voice) => void;
}

const AVATAR_GRADIENTS = [
  { id: 'indigo', label: 'Indigo', bg: '#6366f1' },
  { id: 'sunset', label: 'Sunset', bg: '#f97316' },
  { id: 'emerald', label: 'Emerald', bg: '#10b981' },
  { id: 'cyan', label: 'Cyan', bg: '#06b6d4' },
  { id: 'amber', label: 'Amber', bg: '#f59e0b' },
  { id: 'purple', label: 'Purple', bg: '#a855f7' },
  { id: 'titanium', label: 'Titanium', bg: '#94a3b8' },
];

const EMOJI_OPTIONS = ['🎙️', '🎧', '⚡', '🌟', '💎', '🌊', '🔮', '🤖', '👑', '🔥'];

export default function VoiceLab({
  customVoices,
  onVoiceCreated,
  onVoiceDeleted,
  onSelectForTTS,
}: VoiceLabProps) {
  const [tab, setTab] = useState<'clone' | 'design'>('clone');

  // Form shared avatar style state
  const [selectedGradient, setSelectedGradient] = useState<string>('indigo');
  const [selectedEmoji, setSelectedEmoji] = useState<string>('🎙️');

  // Clone form state
  const [cloneName, setCloneName] = useState('');
  const [cloneGender, setCloneGender] = useState<'male' | 'female'>('male');
  const [cloneAccent, setCloneAccent] = useState('Indonesian');
  const [cloneDescription, setCloneDescription] = useState('');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [acousticStats, setAcousticStats] = useState<{
    durationSec: number;
    estimatedPitchHz: number;
    suggestedGender: 'male' | 'female';
    qualityLabel: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Design form state
  const [designName, setDesignName] = useState('');
  const [designGender, setDesignGender] = useState<'male' | 'female'>('female');
  const [designAge, setDesignAge] = useState<'young' | 'middle-aged' | 'old'>('young');
  const [designAccent, setDesignAccent] = useState('Indonesian');
  const [designStrength, setDesignStrength] = useState(80);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const processNewSampleBlob = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setRecordedBlobUrl(url);

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      setAudioBase64(reader.result as string);
    };

    try {
      const analysis = await analyzeVoiceSampleAcoustics(blob);
      setAcousticStats(analysis);
      setCloneGender(analysis.suggestedGender);
    } catch {
      setAcousticStats(null);
    }
  };

  const startRecording = async () => {
    try {
      setErrorMsg('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processNewSampleBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setErrorMsg('Gagal mengakses mikrofon: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('File audio terlalu besar (maks 15MB)');
      return;
    }

    if (!cloneName) {
      setCloneName(file.name.replace(/\.[^/.]+$/, ''));
    }
    processNewSampleBlob(file);
  };

  const handleCreateClone = async () => {
    if (!cloneName.trim()) {
      setErrorMsg('Nama suara wajib diisi');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cloneName.trim(),
          gender: cloneGender,
          accent: cloneAccent,
          description:
            cloneDescription ||
            `Cloned Voice (${cloneAccent}${
              acousticStats ? ` • ~${acousticStats.estimatedPitchHz}Hz` : ''
            })`,
          audioBase64,
          category: 'cloned',
          age: 'young',
          estimatedPitchHz: acousticStats?.estimatedPitchHz,
          avatarGradient: selectedGradient,
          avatarEmoji: selectedEmoji,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat clone');

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      onVoiceCreated(data.voice);
      setCloneName('');
      setCloneDescription('');
      setAudioBase64(null);
      setRecordedBlobUrl(null);
      setAcousticStats(null);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDesigned = async () => {
    if (!designName.trim()) {
      setErrorMsg('Nama karakter suara wajib diisi');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: designName.trim(),
          category: 'designed',
          gender: designGender,
          accent: designAccent,
          age: designAge,
          description: `Voice Design: ${designGender}, ${designAge}, Aksen ${designAccent} (${designStrength}%)`,
          avatarGradient: selectedGradient,
          avatarEmoji: selectedEmoji,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat suara');

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      onVoiceCreated(data.voice);
      setDesignName('');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="Voice Lab & Cloning"
        mobileTitle="Kloning Suara"
        subtitle="Kloning suara dari sampel atau rancang karakter suara baru."
        titleAddon={
          <TooltipInfo
            title="Instant Clone & Voice Design"
            text="Rekam atau unggah sampel suara untuk menganalisis frekuensi vokal (Hz) dan membuat profil kloning di PC lokal, atau rancang karakter baru dengan Voice Design."
            position="right"
          />
        }
      />

      <div className="grid grid-cols-2 sm:inline-grid w-full sm:w-auto rounded-xl bg-dark-900 p-1 border border-white/10">
        <button
          onClick={() => {
            haptic();
            setTab('clone');
            setErrorMsg('');
          }}
          className={`h-10 sm:h-auto rounded-lg px-3 sm:px-4 sm:py-1.5 text-[13px] sm:text-xs font-bold whitespace-nowrap transition-all ${
            tab === 'clone' ? 'bg-brand-600 text-white shadow' : 'text-dark-300 hover:text-white'
          }`}
        >
          <span className="sm:hidden">Kloning Instan</span>
          <span className="hidden sm:inline">Instant Voice Clone</span>
        </button>
        <button
          onClick={() => {
            haptic();
            setTab('design');
            setErrorMsg('');
          }}
          className={`h-10 sm:h-auto rounded-lg px-3 sm:px-4 sm:py-1.5 text-[13px] sm:text-xs font-bold whitespace-nowrap transition-all ${
            tab === 'design' ? 'bg-brand-600 text-white shadow' : 'text-dark-300 hover:text-white'
          }`}
        >
          Voice Design
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-950/60 border border-rose-500/40 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          {errorMsg}
        </div>
      )}

      {tab === 'clone' ? (
        <div className="studio-card rounded-2xl p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* Left: Voice Identity */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                Nama Suara Kloning *
              </label>
              <input
                type="text"
                placeholder="Contoh: Suara Saya, Narator Studio..."
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-white/10 px-3.5 h-11 sm:h-auto sm:py-2.5 text-sm text-white placeholder-dark-400 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">Gender</label>
                <select
                  value={cloneGender}
                  onChange={(e) => setCloneGender(e.target.value as any)}
                  className="w-full rounded-xl bg-dark-850 border border-white/10 px-3 h-11 sm:h-auto sm:py-2.5 text-xs font-semibold text-white"
                >
                  <option value="male">Pria (Male)</option>
                  <option value="female">Wanita (Female)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Aksen & Logat
                </label>
                <select
                  value={cloneAccent}
                  onChange={(e) => setCloneAccent(e.target.value)}
                  className="w-full rounded-xl bg-dark-850 border border-white/10 px-3 h-11 sm:h-auto sm:py-2.5 text-xs font-semibold text-white"
                >
                  <option value="Indonesian">🇮🇩 Indonesia (Nasional)</option>
                  <option value="Indonesian (Jawa)">🇮🇩 Aksen Jawa</option>
                  <option value="Indonesian (Sunda)">🇮🇩 Aksen Sunda</option>
                  <option value="American">🇺🇸 English (American)</option>
                  <option value="British">🇬🇧 English (British)</option>
                  <option value="Australian">🇦🇺 English (Australian)</option>
                  <option value="Japanese">🇯🇵 Japanese</option>
                  <option value="Korean">🇰🇷 Korean</option>
                  <option value="Arabic">🇸🇦 Arabic</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                Catatan Karakter (Opsional)
              </label>
              <input
                type="text"
                placeholder="Misal: Santai, formal, hangat..."
                value={cloneDescription}
                onChange={(e) => setCloneDescription(e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-white/10 px-3.5 h-11 sm:h-auto sm:py-2.5 text-xs text-white placeholder-dark-400 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Avatar Stylizer */}
            <div>
              <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                Warna Orb & Ikon Avatar
              </label>
              <div className="grid grid-cols-7 gap-1 sm:flex sm:items-center sm:gap-2 mb-2">
                {AVATAR_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      haptic();
                      setSelectedGradient(g.id);
                    }}
                    className="flex h-10 sm:h-auto items-center justify-center"
                    title={g.label}
                    aria-label={`Warna ${g.label}`}
                    aria-pressed={selectedGradient === g.id}
                  >
                    <span
                      className={`block h-7 w-7 sm:h-5 sm:w-5 rounded-full transition-all ${
                        selectedGradient === g.id
                          ? 'ring-2 ring-white scale-110 shadow-sm'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: g.bg }}
                    />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:flex sm:items-center sm:gap-1 sm:overflow-x-auto no-scrollbar">
                {EMOJI_OPTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      haptic();
                      setSelectedEmoji(em);
                    }}
                    aria-pressed={selectedEmoji === em}
                    className={`h-11 sm:h-6 w-full sm:w-6 rounded-xl sm:rounded-md text-lg sm:text-xs flex items-center justify-center transition-all ${
                      selectedEmoji === em
                        ? 'bg-white/20 ring-1 ring-white/40 sm:ring-0 sm:scale-105 shadow-sm'
                        : 'bg-dark-850/60 hover:bg-dark-800'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Audio Sample & Acoustic Analysis */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-dark-200">Sampel Suara</label>
                <TooltipInfo
                  text="Sistem akan otomatis mendeteksi frekuensi dasar (Pitch Hz) dari rekaman Anda."
                  position="left"
                />
              </div>

              <div className="rounded-xl border border-dashed border-white/15 bg-dark-950/60 p-3 sm:p-5 text-center flex flex-col items-center justify-center min-h-[120px] sm:min-h-[140px]">
                {!recordedBlobUrl ? (
                  <div className="grid grid-cols-2 w-full sm:flex sm:w-auto items-center justify-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center justify-center gap-2 h-12 sm:h-auto rounded-xl px-3 sm:px-4 sm:py-2.5 text-[13px] sm:text-xs font-bold whitespace-nowrap transition-all ${
                        isRecording
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-brand-600 text-white hover:bg-brand-500'
                      }`}
                    >
                      {isRecording ? (
                        <Square className="h-3.5 w-3.5 fill-white" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                      {isRecording ? 'Stop Rekam' : 'Rekam Suara'}
                    </button>

                    <label className="flex items-center justify-center gap-2 h-12 sm:h-auto rounded-xl bg-dark-850 text-white hover:bg-dark-800 border border-white/10 px-3 sm:px-4 sm:py-2.5 text-[13px] sm:text-xs font-semibold whitespace-nowrap cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-brand-400" />
                      Upload Audio
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Check className="h-4 w-4" />
                        Sampel Teranalisis
                      </span>
                      <button
                        onClick={() => {
                          setRecordedBlobUrl(null);
                          setAudioBase64(null);
                          setAcousticStats(null);
                        }}
                        className="text-xs text-dark-400 hover:text-rose-400"
                      >
                        Ganti
                      </button>
                    </div>
                    <audio controls src={recordedBlobUrl} className="w-full h-9 rounded-lg" />

                    {acousticStats && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-dark-900 px-3 py-2 text-[11px] text-dark-200 border border-white/10">
                        <span className="flex items-center gap-1 text-brand-300 font-semibold">
                          <Activity className="h-3.5 w-3.5" />
                          F0 Pitch: ~{acousticStats.estimatedPitchHz} Hz
                        </span>
                        <span>Durasi: {acousticStats.durationSec}s</span>
                        <span className="text-emerald-400">{acousticStats.qualityLabel}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateClone}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl sm:rounded-xl bg-gradient-to-r from-brand-500 to-purple-600 px-5 h-12 sm:h-auto sm:py-3 text-sm sm:text-xs font-bold text-white shadow-lg shadow-brand-500/25 hover:from-brand-400 hover:to-purple-500 transition-all disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? 'Membangun Profil Suara...' : 'Simpan Suara Kloning'}
            </button>
          </div>
        </div>
      ) : (
        <div className="studio-card rounded-2xl p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                Nama Karakter Baru *
              </label>
              <input
                type="text"
                placeholder="Contoh: Narator Dokumenter, Asisten Sunda..."
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-white/10 px-3.5 h-11 sm:h-auto sm:py-2.5 text-sm text-white placeholder-dark-400 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">Gender</label>
                <select
                  value={designGender}
                  onChange={(e) => setDesignGender(e.target.value as any)}
                  className="w-full rounded-xl bg-dark-850 border border-white/10 px-3 h-11 sm:h-auto sm:py-2.5 text-xs font-semibold text-white"
                >
                  <option value="female">Wanita</option>
                  <option value="male">Pria</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">Usia</label>
                <select
                  value={designAge}
                  onChange={(e) => setDesignAge(e.target.value as any)}
                  className="w-full rounded-xl bg-dark-850 border border-white/10 px-3 h-11 sm:h-auto sm:py-2.5 text-xs font-semibold text-white"
                >
                  <option value="young">Muda (Young)</option>
                  <option value="middle-aged">Dewasa (Mature)</option>
                  <option value="old">Senior (Deep)</option>
                </select>
              </div>
            </div>

            {/* Avatar Stylizer */}
            <div>
              <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                Warna Orb & Ikon Avatar
              </label>
              <div className="grid grid-cols-7 gap-1 sm:flex sm:items-center sm:gap-2 mb-2">
                {AVATAR_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      haptic();
                      setSelectedGradient(g.id);
                    }}
                    className="flex h-10 sm:h-auto items-center justify-center"
                    title={g.label}
                    aria-label={`Warna ${g.label}`}
                    aria-pressed={selectedGradient === g.id}
                  >
                    <span
                      className={`block h-7 w-7 sm:h-5 sm:w-5 rounded-full transition-all ${
                        selectedGradient === g.id
                          ? 'ring-2 ring-white scale-110 shadow-sm'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: g.bg }}
                    />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:flex sm:items-center sm:gap-1 sm:overflow-x-auto no-scrollbar">
                {EMOJI_OPTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      haptic();
                      setSelectedEmoji(em);
                    }}
                    aria-pressed={selectedEmoji === em}
                    className={`h-11 sm:h-6 w-full sm:w-6 rounded-xl sm:rounded-md text-lg sm:text-xs flex items-center justify-center transition-all ${
                      selectedEmoji === em
                        ? 'bg-white/20 ring-1 ring-white/40 sm:ring-0 sm:scale-105 shadow-sm'
                        : 'bg-dark-850/60 hover:bg-dark-800'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Aksen & Logat
                </label>
                <select
                  value={designAccent}
                  onChange={(e) => setDesignAccent(e.target.value)}
                  className="w-full rounded-xl bg-dark-850 border border-white/10 px-3 h-11 sm:h-auto sm:py-2.5 text-xs font-semibold text-white"
                >
                  <option value="Indonesian">🇮🇩 Bahasa Indonesia</option>
                  <option value="Indonesian (Jawa)">🇮🇩 Aksen Jawa</option>
                  <option value="Indonesian (Sunda)">🇮🇩 Aksen Sunda</option>
                  <option value="American">🇺🇸 English (American)</option>
                  <option value="British">🇬🇧 English (British)</option>
                  <option value="Australian">🇦🇺 English (Australian)</option>
                  <option value="Japanese">🇯🇵 Japanese</option>
                  <option value="Korean">🇰🇷 Korean</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-dark-200 mb-1">
                  <span>Kekuatan Logat Aksen</span>
                  <span className="font-mono text-brand-300">{designStrength}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={designStrength}
                  onChange={(e) => setDesignStrength(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateDesigned}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl sm:rounded-xl bg-brand-600 hover:bg-brand-500 px-5 h-12 sm:h-auto sm:py-3 text-sm sm:text-xs font-bold text-white shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50"
            >
              <Sliders className="h-4 w-4" />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Karakter Suara'}
            </button>
          </div>
        </div>
      )}

      {/* Custom Voices Roster */}
      {customVoices.length > 0 && (
        <div className="studio-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Koleksi Suara Kustom Anda ({customVoices.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customVoices.map((voice) => (
              <div
                key={voice.id}
                className="rounded-xl bg-dark-850/90 p-3.5 border border-white/10 flex flex-col justify-between gap-3 hover:border-brand-400/50 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={voice.avatarUrl}
                      alt={voice.name}
                      className="h-10 w-10 rounded-full object-cover border border-white/15 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{voice.name}</h4>
                      <p className="text-xs text-brand-300 truncate">{voice.accent}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onVoiceDeleted(voice.id)}
                    className="flex h-10 w-10 sm:h-auto sm:w-auto shrink-0 items-center justify-center sm:p-1.5 rounded-lg text-dark-400 hover:text-rose-400 hover:bg-rose-500/10"
                    title="Hapus suara"
                    aria-label="Hapus suara"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="rounded bg-brand-500/20 px-2 py-0.5 text-[11px] font-semibold text-brand-200 uppercase">
                    {voice.category}
                  </span>
                  <button
                    onClick={() => onSelectForTTS(voice)}
                    className="h-9 sm:h-auto px-1 text-[13px] sm:text-xs font-bold text-brand-300 hover:text-white transition-colors"
                  >
                    Pakai di Studio →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
