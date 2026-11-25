'use client';

import React from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Settings,
  AudioWaveform,
  Search,
  Moon,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { haptic } from '@/lib/haptics';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenMobileMenu: () => void;
  onOpenInstall: () => void;
  onOpenSettings: () => void;
  onOpenPronunciation: () => void;
  storageStats: { diskUsageFormatted: string } | null;
  devicePreviewMode?: 'desktop' | 'iphone' | 'android';
  onSetDevicePreviewMode?: (mode: 'desktop' | 'iphone' | 'android') => void;
  isIphonePreview?: boolean;
  onToggleIphonePreview?: () => void;
  onOpenSpotlight?: () => void;
  isOled?: boolean;
  onToggleOledTheme?: () => void;
  /** True when rendered inside the desktop phone simulator frame. */
  insideFrame?: boolean;
}

interface SubPill {
  id: ActiveTab;
  label: string;
  short: string;
}

interface HubInfo {
  title: string;
  pills: SubPill[];
}

/** Hub title + contextual sub-tabs for the active screen. */
export function getHubInfo(activeTab: ActiveTab): HubInfo {
  if (['tts', 'batch'].includes(activeTab)) {
    return {
      title: 'Voiceover',
      pills: [
        { id: 'tts', label: 'Voiceover Naskah', short: 'Satu Naskah' },
        { id: 'batch', label: 'Batch Banyak Naskah', short: 'Batch' },
      ],
    };
  }
  if (['speech2speech', 'isolator'].includes(activeTab)) {
    return {
      title: 'Ubah Vokal',
      pills: [
        { id: 'speech2speech', label: 'Ubah Suara (Changer)', short: 'Ubah Suara' },
        { id: 'isolator', label: 'Isolasi Vokal Video', short: 'Isolasi Vokal' },
      ],
    };
  }
  if (['studio', 'projects'].includes(activeTab)) {
    return {
      title: 'Studio',
      pills: [
        { id: 'studio', label: 'Studio Dubbing & SRT', short: 'Dubbing & SRT' },
        { id: 'projects', label: 'Naskah Seri Panjang', short: 'Naskah Seri' },
      ],
    };
  }
  if (['history', 'analytics'].includes(activeTab)) {
    return {
      title: 'Koleksi',
      pills: [
        { id: 'history', label: 'Riwayat & File CapCut', short: 'Riwayat' },
        { id: 'analytics', label: 'Kapasitas Disk PC', short: 'Penyimpanan' },
      ],
    };
  }
  if (activeTab === 'sfx') {
    return { title: 'Efek Suara', pills: [{ id: 'sfx', label: 'Efek Suara (SFX)', short: 'SFX' }] };
  }
  if (activeTab === 'agents') {
    return { title: 'Agen Suara AI', pills: [{ id: 'agents', label: 'Agen Suara AI', short: 'Agen' }] };
  }
  return {
    title: 'Kloning Suara',
    pills: [{ id: 'voicelab', label: 'Kloning & Desain Suara', short: 'Kloning' }],
  };
}

export default function Header({
  activeTab,
  onTabChange,
  onOpenInstall,
  onOpenSettings,
  devicePreviewMode = 'desktop',
  onSetDevicePreviewMode,
  isIphonePreview = false,
  onToggleIphonePreview,
  onOpenSpotlight,
  isOled = false,
  onToggleOledTheme,
  insideFrame = false,
}: HeaderProps) {
  const hub = getHubInfo(activeTab);
  const subPills = hub.pills;
  // Inside the simulator frame we always render the phone layout.
  const phone = insideFrame;

  const segmented = (
    <div className="flex w-full items-center gap-1 rounded-xl bg-white/[0.05] p-1">
      {subPills.map((pill) => {
        const isActive = activeTab === pill.id;
        return (
          <button
            key={pill.id}
            onClick={() => {
              haptic(8);
              onTabChange(pill.id);
            }}
            className={`flex-1 h-9 rounded-lg px-3 text-[13px] font-medium transition-all ${
              isActive ? 'bg-white text-black font-semibold shadow-sm' : 'text-dark-300 active:text-white'
            }`}
          >
            {pill.short}
          </button>
        );
      })}
    </div>
  );

  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-dark-200 active:scale-95 transition-all';

  /* ---------------- PHONE LAYOUT (real phone < lg, or inside simulator) ---------------- */
  const phoneHeader = (
    <header
      className={`sticky top-0 z-30 border-b border-white/[0.06] bg-dark-950/85 backdrop-blur-xl px-4 ${
        phone ? '' : 'lg:hidden pt-safe'
      }`}
    >
      <div className="flex h-12 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-black">
            <AudioWaveform className="h-[18px] w-[18px]" />
          </div>
          <h1 className="truncate text-[17px] font-bold tracking-tight text-white">{hub.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpenSpotlight && (
            <button onClick={onOpenSpotlight} className={iconBtn} aria-label="Cari fitur atau suara" title="Cari">
              <Search className="h-4 w-4" />
            </button>
          )}
          <button onClick={onOpenSettings} className={iconBtn} aria-label="Pengaturan" title="Pengaturan">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
      {subPills.length > 1 && <div className="pb-2.5">{segmented}</div>}
    </header>
  );

  if (phone) return phoneHeader;

  /* ---------------- DESKTOP LAYOUT (≥ lg) ---------------- */
  return (
    <>
      {phoneHeader}
      <header className="hidden lg:flex sticky top-0 z-30 items-center justify-between border-b border-white/[0.06] bg-dark-950/85 backdrop-blur-xl px-6 py-2.5">
        <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1 border border-white/[0.06]">
          {subPills.map((pill) => {
            const isActive = activeTab === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => onTabChange(pill.id)}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all shrink-0 ${
                  isActive ? 'bg-white text-black font-semibold shadow-sm' : 'text-dark-300 hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          {onOpenSpotlight && (
            <button
              onClick={onOpenSpotlight}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] px-3 py-1.5 text-xs text-dark-300 hover:text-white transition-all"
              title="Buka Spotlight Command Palette (Cmd + K)"
            >
              <Search className="h-3 w-3" />
              <span className="text-[11px]">Cari...</span>
              <kbd className="inline-flex rounded bg-white/10 px-1 text-[9px] font-mono">⌘K</kbd>
            </button>
          )}

          {onToggleOledTheme && (
            <button
              onClick={onToggleOledTheme}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                isOled
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-dark-300 hover:text-white'
              }`}
              title={isOled ? 'Ganti ke Tema Titanium Dark' : 'Ganti ke Tema OLED Pure Black'}
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
          )}

          {onSetDevicePreviewMode ? (
            <div className="flex items-center rounded-full bg-white/[0.05] border border-white/[0.08] p-0.5">
              {(
                [
                  { id: 'desktop', label: 'PC', icon: Monitor },
                  { id: 'iphone', label: 'iPhone', icon: Smartphone },
                  { id: 'android', label: 'Android', icon: Smartphone },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = devicePreviewMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onSetDevicePreviewMode(m.id)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                      active
                        ? m.id === 'android'
                          ? 'bg-purple-400 text-black shadow-sm'
                          : 'bg-white text-black shadow-sm'
                        : 'text-dark-300 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          ) : onToggleIphonePreview ? (
            <button
              onClick={onToggleIphonePreview}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                isIphonePreview
                  ? 'bg-white text-black border-white shadow-sm'
                  : 'bg-white/[0.05] text-dark-200 border-white/[0.08] hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              {isIphonePreview ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
              <span>{isIphonePreview ? 'Layar Penuh' : 'Versi iPhone'}</span>
            </button>
          ) : null}

          <button
            onClick={onOpenInstall}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white transition-all"
            title="Install ke Windows, macOS, iPhone, atau Android"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Install</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-dark-300 hover:text-white transition-colors"
            title="Pengaturan"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
    </>
  );
}
