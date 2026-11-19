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
}: HeaderProps) {
  // Contextual Sub-Pills for active hub (tailored for social media creators & sellers)
  const getSubPills = (): { id: ActiveTab; label: string }[] => {
    if (['tts', 'batch'].includes(activeTab)) {
      return [
        { id: 'tts', label: 'Voiceover Naskah' },
        { id: 'batch', label: 'Batch Banyak Naskah' },
      ];
    }
    if (['speech2speech', 'isolator'].includes(activeTab)) {
      return [
        { id: 'speech2speech', label: 'Ubah Suara (Changer)' },
        { id: 'isolator', label: 'Isolasi Vokal Video' },
      ];
    }
    if (['studio', 'projects'].includes(activeTab)) {
      return [
        { id: 'studio', label: 'Studio Dubbing & SRT' },
        { id: 'projects', label: 'Naskah Seri Panjang' },
      ];
    }
    if (['history', 'analytics'].includes(activeTab)) {
      return [
        { id: 'history', label: 'Riwayat & File CapCut' },
        { id: 'analytics', label: 'Kapasitas Disk PC' },
      ];
    }
    return [{ id: 'voicelab', label: 'Kloning & Desain Suara' }];
  };

  const subPills = getSubPills();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-dark-950/85 backdrop-blur-xl px-4 sm:px-6 py-2.5">
      {/* Left: Mobile Logo + Clean Sub-Pills */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        <div className="flex lg:hidden items-center gap-2 pr-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black">
            <AudioWaveform className="h-4 w-4" />
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1 border border-white/[0.06]">
          {subPills.map((pill) => {
            const isActive = activeTab === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => onTabChange(pill.id)}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-dark-300 hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: iPhone Mode Toggle, Install App & Settings */}
      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        {onOpenSpotlight && (
          <button
            onClick={onOpenSpotlight}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] px-2.5 sm:px-3 py-1.5 text-xs text-dark-300 hover:text-white transition-all"
            title="Buka Spotlight Command Palette (Cmd + K)"
          >
            <Search className="h-3 w-3" />
            <span className="hidden sm:inline text-[11px]">Cari...</span>
            <kbd className="hidden sm:inline-flex rounded bg-white/10 px-1 py-0.2 text-[9px] font-mono">⌘K</kbd>
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
          <div className="hidden md:flex items-center rounded-full bg-white/[0.05] border border-white/[0.08] p-0.5">
            <button
              onClick={() => onSetDevicePreviewMode('desktop')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                devicePreviewMode === 'desktop'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-dark-300 hover:text-white'
              }`}
              title="Tampilan Desktop PC"
            >
              <Monitor className="h-3 w-3" />
              <span>PC</span>
            </button>
            <button
              onClick={() => onSetDevicePreviewMode('iphone')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                devicePreviewMode === 'iphone'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-dark-300 hover:text-white'
              }`}
              title="Tampilan iPhone 16 Pro (iOS 18)"
            >
              <Smartphone className="h-3 w-3" />
              <span>iPhone</span>
            </button>
            <button
              onClick={() => onSetDevicePreviewMode('android')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                devicePreviewMode === 'android'
                  ? 'bg-purple-400 text-black shadow-sm font-bold'
                  : 'text-dark-300 hover:text-white'
              }`}
              title="Tampilan Android Galaxy S25 / Pixel 9"
            >
              <Smartphone className="h-3 w-3 text-purple-300" />
              <span>Android</span>
            </button>
          </div>
        ) : onToggleIphonePreview ? (
          <button
            onClick={onToggleIphonePreview}
            className={`hidden md:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
              isIphonePreview
                ? 'bg-white text-black border-white shadow-sm'
                : 'bg-white/[0.05] text-dark-200 border-white/[0.08] hover:bg-white/[0.1] hover:text-white'
            }`}
            title="Lihat & Gunakan Versi iPhone"
          >
            {isIphonePreview ? (
              <>
                <Monitor className="h-3.5 w-3.5" />
                <span>Layar Penuh</span>
              </>
            ) : (
              <>
                <Smartphone className="h-3.5 w-3.5" />
                <span>Versi iPhone</span>
              </>
            )}
          </button>
        ) : null}

        <button
          onClick={onOpenInstall}
          className="flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white transition-all"
          title="Install ke Windows, macOS, iPhone, atau Android"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Install</span>
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
  );
}
