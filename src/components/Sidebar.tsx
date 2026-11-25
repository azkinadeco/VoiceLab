'use client';

import React from 'react';
import {
  Mic,
  Dna,
  AudioWaveform,
  Film,
  History,
  Settings,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
} from 'lucide-react';
import { VoiceLabLogoIcon } from './CustomIcons';

export type ActiveTab =
  | 'tts'
  | 'voicelab'
  | 'speech2speech'
  | 'sfx'
  | 'isolator'
  | 'studio'
  | 'agents'
  | 'projects'
  | 'batch'
  | 'analytics'
  | 'history';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenSettings: () => void;
  onOpenInstall: () => void;
  storageStats: { diskUsageFormatted: string; totalGenerations: number } | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  devicePreviewMode?: 'desktop' | 'iphone' | 'android';
  onSetDevicePreviewMode?: (mode: 'desktop' | 'iphone' | 'android') => void;
  isIphonePreview?: boolean;
  onToggleIphonePreview?: () => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  onOpenSettings,
  onOpenInstall,
  storageStats,
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  devicePreviewMode = 'desktop',
  onSetDevicePreviewMode,
  isIphonePreview = false,
  onToggleIphonePreview,
}: SidebarProps) {
  // 5 Focused Navigation Hubs (Short, clean, scannable labels)
  const primaryHubs = [
    {
      id: 'tts' as ActiveTab,
      matchIds: ['tts', 'batch'],
      label: 'Voiceover',
      icon: Mic,
    },
    {
      id: 'speech2speech' as ActiveTab,
      matchIds: ['speech2speech', 'isolator'],
      label: 'Ubah Suara',
      icon: AudioWaveform,
    },
    {
      id: 'voicelab' as ActiveTab,
      matchIds: ['voicelab'],
      label: 'Kloning Suara',
      icon: Dna,
    },
    {
      id: 'studio' as ActiveTab,
      matchIds: ['studio', 'projects'],
      label: 'Studio Dubbing',
      icon: Film,
    },
    {
      id: 'history' as ActiveTab,
      matchIds: ['history', 'analytics'],
      label: 'Riwayat Audio',
      icon: History,
      count: storageStats?.totalGenerations,
    },
  ];

  return (
    <>
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Desktop Left Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 hidden lg:flex flex-col justify-between bg-dark-950 border-r border-white/[0.07] transition-all duration-300 ${
          isCollapsed ? 'w-[72px]' : 'w-56'
        }`}
      >
        <div>
          {/* Brand Logo + Collapse Toggle */}
          <div
            className={`flex items-center justify-between px-4 py-4 ${
              isCollapsed ? 'flex-col gap-3' : ''
            }`}
          >
            <div className="flex items-center gap-2.5">
              <VoiceLabLogoIcon className="h-8 w-8 shrink-0 shadow-sm" />
              {!isCollapsed && (
                <span className="text-sm font-bold text-white tracking-tight">Voice Lab</span>
              )}
            </div>

            <button
              onClick={onToggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-dark-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title={isCollapsed ? 'Buka Sidebar' : 'Kecilkan Sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* 5 Primary Navigation Items */}
          <nav className="px-2.5 py-2 space-y-1">
            {primaryHubs.map((hub) => {
              const Icon = hub.icon;
              const isActive = hub.matchIds.includes(activeTab);
              return (
                <button
                  key={hub.id}
                  onClick={() => onTabChange(hub.id)}
                  title={isCollapsed ? hub.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white/[0.1] text-white font-semibold'
                      : 'text-dark-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-dark-400'}`} />
                    {!isCollapsed && <span>{hub.label}</span>}
                  </div>
                  {!isCollapsed && hub.count !== undefined && hub.count > 0 && (
                    <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-dark-300">
                      {hub.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-2.5 border-t border-white/[0.06] space-y-1">
          {onSetDevicePreviewMode ? (
            <div className="space-y-1">
              <button
                onClick={() =>
                  onSetDevicePreviewMode(
                    devicePreviewMode === 'desktop'
                      ? 'iphone'
                      : devicePreviewMode === 'iphone'
                      ? 'android'
                      : 'desktop'
                  )
                }
                title="Ganti Mode Tampilan (Desktop / iPhone / Android)"
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                } rounded-xl text-xs font-medium transition-colors ${
                  devicePreviewMode !== 'desktop'
                    ? 'bg-white text-black font-semibold'
                    : 'text-dark-300 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Smartphone className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <span>
                    {devicePreviewMode === 'desktop'
                      ? 'Mode HP'
                      : devicePreviewMode === 'iphone'
                      ? 'iPhone 16 Pro'
                      : 'Android S25'}
                  </span>
                )}
              </button>
            </div>
          ) : onToggleIphonePreview ? (
            <button
              onClick={onToggleIphonePreview}
              title="Beralih Mode iPhone / Desktop"
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
              } rounded-xl text-xs font-medium transition-colors ${
                isIphonePreview
                  ? 'bg-white text-black font-semibold'
                  : 'text-dark-300 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Smartphone className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>{isIphonePreview ? 'Mode Desktop' : 'Versi iPhone'}</span>}
            </button>
          ) : null}

          <button
            onClick={onOpenSettings}
            title="Pengaturan"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
            } rounded-xl text-xs font-medium text-dark-300 hover:text-white hover:bg-white/[0.05] transition-colors`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Pengaturan</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
