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
import { VoiceLabLogoIcon } from './CustomIcons';
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
          <VoiceLabLogoIcon className="h-8 w-8 shrink-0" />
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
        {subPills.length > 1 ? (
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
            {subPills.map((pill) => {
              const isActive = activeTab === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => onTabChange(pill.id)}
                  className={`rounded-lg px-3.5 py-1 text-xs font-medium transition-all shrink-0 ${
                    isActive ? 'bg-white text-black font-semibold shadow-sm' : 'text-dark-300 hover:text-white'
                  }`}
                >
                  {pill.short}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-sm font-bold text-white tracking-tight">{hub.title}</div>
        )}

        <div className="flex items-center gap-2 shrink-0 pl-2">
          {onOpenSpotlight && (
            <button
              onClick={onOpenSpotlight}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] px-3 py-1.5 text-xs text-dark-300 hover:text-white transition-all"
              title="Cari fitur atau suara (Cmd + K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-[11.5px]">Cari</span>
              <kbd className="inline-flex rounded bg-white/10 px-1 text-[9px] font-mono">⌘K</kbd>
            </button>
          )}

          {onSetDevicePreviewMode && (
            <button
              onClick={() => onSetDevicePreviewMode(devicePreviewMode === 'desktop' ? 'iphone' : 'desktop')}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] px-3 py-1.5 text-xs font-medium text-dark-200 hover:text-white transition-all"
              title="Pratinjau tampilan HP"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mode HP</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-dark-300 hover:text-white transition-colors"
            title="Pengaturan"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
    </>
  );
}
