'use client';

import React from 'react';
import {
  AudioWaveform,
  Scissors,
  Zap,
  Bot,
  Layers,
  BookOpenText,
  HardDrive,
  BookA,
  Settings,
  Download,
  Moon,
  X,
  ChevronRight,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { haptic } from '@/lib/haptics';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenPronunciation: () => void;
  onOpenSettings: () => void;
  onOpenInstall: () => void;
  isOled: boolean;
  onToggleOled: () => void;
  diskUsage?: string;
  /** Render inside the simulator frame (absolute) instead of the viewport (fixed). */
  insideFrame?: boolean;
}

const TOOLS: { id: ActiveTab; label: string; desc: string; icon: typeof Zap; tint: string }[] = [
  { id: 'speech2speech', label: 'Ubah Suara', desc: 'Rekam → suara lain', icon: AudioWaveform, tint: 'from-indigo-500/30 to-indigo-500/5 text-indigo-300' },
  { id: 'isolator', label: 'Isolasi Vokal', desc: 'Hapus noise video', icon: Scissors, tint: 'from-emerald-500/30 to-emerald-500/5 text-emerald-300' },
  { id: 'sfx', label: 'Efek Suara', desc: 'SFX untuk konten', icon: Zap, tint: 'from-amber-500/30 to-amber-500/5 text-amber-300' },
  { id: 'agents', label: 'Agen Suara AI', desc: 'CS & live chat', icon: Bot, tint: 'from-sky-500/30 to-sky-500/5 text-sky-300' },
  { id: 'batch', label: 'Batch Naskah', desc: 'Banyak naskah sekaligus', icon: Layers, tint: 'from-pink-500/30 to-pink-500/5 text-pink-300' },
  { id: 'projects', label: 'Naskah Seri', desc: 'Audiobook & episode', icon: BookOpenText, tint: 'from-violet-500/30 to-violet-500/5 text-violet-300' },
];

export default function MoreSheet({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onOpenPronunciation,
  onOpenSettings,
  onOpenInstall,
  isOled,
  onToggleOled,
  diskUsage,
  insideFrame = false,
}: MoreSheetProps) {
  if (!isOpen) return null;

  const go = (tab: ActiveTab) => {
    haptic(8);
    onSelectTab(tab);
    onClose();
  };

  const rows = [
    { label: 'Kamus Pelafalan', sub: 'COD, UMKM, ongkir…', icon: BookA, action: onOpenPronunciation },
    { label: 'Penyimpanan', sub: diskUsage ? `${diskUsage} terpakai` : 'Kapasitas disk', icon: HardDrive, action: () => onSelectTab('analytics') },
    { label: 'Pasang Aplikasi', sub: 'iPhone, Android, PC', icon: Download, action: onOpenInstall },
    { label: 'Pengaturan', sub: 'Engine suara & format', icon: Settings, action: onOpenSettings },
  ];

  return (
    <div
      className={`${insideFrame ? 'absolute' : 'fixed'} inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Fitur lainnya"
        onClick={(e) => e.stopPropagation()}
        className="sheet-slide-up w-full max-w-lg rounded-t-[28px] border-t border-white/10 bg-dark-900 px-4 pt-2 shadow-2xl"
        style={{ paddingBottom: insideFrame ? 20 : 'calc(var(--sab) + 16px)' }}
      >
        <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-white">Fitur Lainnya</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-dark-200"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-all active:scale-[0.97] ${
                  active ? 'border-white/40 bg-white/[0.08]' : 'border-white/[0.07] bg-white/[0.03]'
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${t.tint}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-tight text-white">{t.label}</div>
                  <div className="mt-0.5 text-[11px] leading-tight text-dark-400">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Settings list (iOS grouped style) */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
          {rows.map((r, i) => {
            const Icon = r.icon;
            return (
              <button
                key={r.label}
                onClick={() => {
                  haptic(8);
                  onClose();
                  r.action();
                }}
                className={`flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.06] ${
                  i > 0 ? 'border-t border-white/[0.06]' : ''
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 text-dark-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-white">{r.label}</div>
                  <div className="truncate text-[12px] text-dark-400">{r.sub}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-dark-500" />
              </button>
            );
          })}
          <label className="flex w-full items-center gap-3 border-t border-white/[0.06] px-3.5 py-3">
            <Moon className="h-[18px] w-[18px] shrink-0 text-dark-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-white">Mode OLED Hitam Pekat</div>
              <div className="text-[12px] text-dark-400">Hemat baterai di layar OLED</div>
            </div>
            <button
              role="switch"
              aria-checked={isOled}
              onClick={() => {
                haptic(8);
                onToggleOled();
              }}
              className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
                isOled ? 'bg-emerald-500' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all ${
                  isOled ? 'left-[22px]' : 'left-[2px]'
                }`}
              />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}
