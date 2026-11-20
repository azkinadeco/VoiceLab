'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Mic,
  Dna,
  AudioWaveform,
  ShieldCheck,
  Film,
  Bot,
  BookOpen,
  Layers,
  Sparkles,
  History,
  BarChart3,
  Download,
  Settings,
  BookA,
  Smartphone,
  Monitor,
  Moon,
  ArrowRight,
  CornerDownLeft,
  X,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { Voice } from '@/lib/types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  voices: Voice[];
  onSelectVoice: (voice: Voice) => void;
  onOpenInstall: () => void;
  onOpenSettings: () => void;
  onOpenPronunciation: () => void;
  onToggleIphone: () => void;
  onSelectDeviceMode?: (mode: 'desktop' | 'iphone' | 'android') => void;
  onToggleOledTheme: () => void;
  onClearText?: () => void;
  isOled: boolean;
}

interface CommandItem {
  id: string;
  category: 'Navigasi' | 'Suara' | 'Aksi Cepat';
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export default function CommandPaletteModal({
  isOpen,
  onClose,
  onSelectTab,
  voices,
  onSelectVoice,
  onOpenInstall,
  onOpenSettings,
  onOpenPronunciation,
  onToggleIphone,
  onSelectDeviceMode,
  onToggleOledTheme,
  onClearText,
  isOled,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build items list
  const allItems: CommandItem[] = [
    // Navigation
    {
      id: 'tab-tts',
      category: 'Navigasi',
      title: 'Voiceover Konten (Text to Speech)',
      subtitle: 'Sintesis suara neural dengan naskah iklan, promo olshop & hook TikTok',
      icon: Mic,
      action: () => onSelectTab('tts'),
    },
    {
      id: 'tab-voicelab',
      category: 'Navigasi',
      title: 'Kloning Suara Sendiri (Voice Clone)',
      subtitle: 'Buat kloning suara kreator atau desain karakter vokal olshop',
      icon: Dna,
      action: () => onSelectTab('voicelab'),
    },
    {
      id: 'tab-speech2speech',
      category: 'Navigasi',
      title: 'Ubah Suara (Voice Changer)',
      subtitle: 'Ubah timbre rekaman vokal ke karakter lain',
      icon: AudioWaveform,
      action: () => onSelectTab('speech2speech'),
    },
    {
      id: 'tab-isolator',
      category: 'Navigasi',
      title: 'Isolasi Vokal & Hapus Noise Video (MP4/MOV)',
      subtitle: 'Ekstrak vokal bersih langsung dari rekaman video konten',
      icon: ShieldCheck,
      action: () => onSelectTab('isolator'),
    },
    {
      id: 'tab-studio',
      category: 'Navigasi',
      title: 'Studio Dubbing & Subtitle CapCut',
      subtitle: 'Percakapan multi-karakter dan ekspor file subtitle .SRT',
      icon: Film,
      action: () => onSelectTab('studio'),
    },
    {
      id: 'tab-batch',
      category: 'Navigasi',
      title: 'Batch Naskah Banyak (CSV / List)',
      subtitle: 'Generate puluhan audio iklan sekaligus dalam satu antrian',
      icon: Layers,
      action: () => onSelectTab('batch'),
    },
    {
      id: 'tab-history',
      category: 'Navigasi',
      title: 'Riwayat Audio & File CapCut',
      subtitle: 'Kelola, salin naskah, dan unduh MP3/SRT ke PC',
      icon: History,
      action: () => onSelectTab('history'),
    },
    {
      id: 'tab-analytics',
      category: 'Navigasi',
      title: 'Manajemen Penyimpanan Hard Disk PC',
      subtitle: 'Pantau kapasitas disk dan bersihkan cache audio lama',
      icon: BarChart3,
      action: () => onSelectTab('analytics'),
    },

    // Quick Actions
    {
      id: 'act-install',
      category: 'Aksi Cepat',
      title: 'Install Aplikasi Desktop / Mobile',
      subtitle: 'Windows, macOS, iPhone iOS, & Android',
      icon: Download,
      action: onOpenInstall,
    },
    {
      id: 'act-settings',
      category: 'Aksi Cepat',
      title: 'Buka Pengaturan Sistem',
      subtitle: 'Konfigurasi storage, fallback engine, & API',
      icon: Settings,
      action: onOpenSettings,
    },
    {
      id: 'act-pronunciation',
      category: 'Aksi Cepat',
      title: 'Kamus Pelafalan & Fonem',
      subtitle: 'Aturan ejaan kustom untuk akronim dan dialek',
      icon: BookA,
      action: onOpenPronunciation,
    },
    {
      id: 'act-iphone',
      category: 'Aksi Cepat',
      title: 'Simulator iPhone 16 Pro (iOS 18)',
      subtitle: 'Tampilan Dynamic Island & Cupertino Bottom Bar',
      icon: Smartphone,
      action: () => {
        if (onSelectDeviceMode) {
          onSelectDeviceMode('iphone');
        } else {
          onToggleIphone();
        }
      },
    },
    {
      id: 'act-android',
      category: 'Aksi Cepat',
      title: 'Simulator Android (Galaxy S25 / Pixel 9)',
      subtitle: 'Tampilan Material You 3 Pill & Punch Hole Camera',
      icon: Smartphone,
      action: () => {
        if (onSelectDeviceMode) {
          onSelectDeviceMode('android');
        } else {
          onToggleIphone();
        }
      },
    },
    {
      id: 'act-desktop',
      category: 'Aksi Cepat',
      title: 'Mode Layar Penuh Desktop PC',
      subtitle: 'Kembali ke workspace studio layar lebar',
      icon: Monitor,
      action: () => {
        if (onSelectDeviceMode) {
          onSelectDeviceMode('desktop');
        } else {
          onToggleIphone();
        }
      },
    },
    {
      id: 'act-oled',
      category: 'Aksi Cepat',
      title: isOled ? 'Ganti ke Tema Titanium Slate' : 'Ganti ke Tema OLED Pure Black',
      subtitle: 'Kontras maksimum hemat daya baterai',
      icon: Moon,
      action: onToggleOledTheme,
    },
  ];

  if (onClearText) {
    allItems.push({
      id: 'act-clear',
      category: 'Aksi Cepat',
      title: 'Bersihkan Teks Editor',
      subtitle: 'Kosongkan kolom teks di halaman Text-to-Speech',
      icon: X,
      action: onClearText,
    });
  }

  // Voice Items
  const voiceItems: CommandItem[] = voices.map((v) => ({
    id: `voice-${v.id}`,
    category: 'Suara',
    title: `${v.name} (${v.accent})`,
    subtitle: `${v.gender === 'male' ? 'Pria' : 'Wanita'} • ${v.description || v.labels?.tone || 'Neural'}`,
    icon: Mic,
    action: () => {
      onSelectVoice(v);
      onSelectTab('tts');
    },
  }));

  const combined = [...allItems, ...voiceItems];

  const filtered = query.trim()
    ? combined.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="m-sheet-overlay fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="m-sheet relative w-full max-w-xl rounded-2xl bg-dark-900/95 border border-white/15 shadow-2xl overflow-hidden backdrop-blur-2xl flex flex-col h-[85dvh] sm:h-auto max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cari fitur"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Box */}
        <div className="flex shrink-0 items-center gap-3 px-4 pt-2 pb-3 sm:py-3.5 border-b border-white/10">
          <div className="flex flex-1 min-w-0 items-center gap-3 h-11 sm:h-auto rounded-xl sm:rounded-none bg-white/[0.06] sm:bg-transparent px-3 sm:px-0">
          <Search className="h-4 w-4 text-dark-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Cari fitur, suara karakter, atau aksi (Ketik 'Ardi', 'Jawa', 'Install')..."
            enterKeyHint="go"
            className="w-full min-w-0 bg-transparent text-base sm:text-sm text-white placeholder-dark-500 focus:outline-none"
          />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="sm:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dark-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-dark-300">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1 no-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-dark-400">
              Tidak ada fitur atau suara yang cocok dengan "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-3 sm:p-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? 'bg-brand-600 text-white' : 'hover:bg-white/[0.04] text-dark-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-dark-800 text-dark-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-xs font-semibold text-white truncate">
                          {item.title}
                        </span>
                        <span
                          className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-dark-800 text-dark-400'
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? 'text-white/80' : 'text-dark-400'
                          }`}
                        >
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-white/80 shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="hidden sm:flex px-4 py-2 border-t border-white/10 items-center justify-between text-[11px] text-dark-400 bg-dark-950/50">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-mono">↑</kbd>
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-mono">↓</kbd>
              navigasi
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-mono">↵</kbd>
              pilih
            </span>
          </div>
          <span className="text-[10px] text-dark-500">Spotlight Voice Lab</span>
        </div>
      </div>
    </div>
  );
}
