'use client';

import React from 'react';
import { Mic, Dna, AudioWaveform, Film, History } from 'lucide-react';
import { ActiveTab } from './Sidebar';

export type MobilePlatform = 'ios' | 'android';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  platform?: MobilePlatform;
  totalGenerations?: number;
  insideFrame?: boolean;
}

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  platform = 'ios',
  totalGenerations = 0,
  insideFrame = false,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'tts' as ActiveTab,
      matchIds: ['tts', 'batch'],
      label: platform === 'ios' ? 'Voiceover' : 'Suara',
      icon: Mic,
    },
    {
      id: 'voicelab' as ActiveTab,
      matchIds: ['voicelab'],
      label: 'Kloning',
      icon: Dna,
    },
    {
      id: 'speech2speech' as ActiveTab,
      matchIds: ['speech2speech', 'isolator'],
      label: platform === 'ios' ? 'Ubah Vokal' : 'Isolator',
      icon: AudioWaveform,
    },
    {
      id: 'studio' as ActiveTab,
      matchIds: ['studio', 'projects'],
      label: 'Studio',
      icon: Film,
    },
    {
      id: 'history' as ActiveTab,
      matchIds: ['history', 'analytics'],
      label: platform === 'ios' ? 'Koleksi' : 'Arsip',
      icon: History,
      badge: totalGenerations > 0 ? totalGenerations : null,
    },
  ];

  const handleTabClick = (tabId: ActiveTab) => {
    // Subtle Haptic feedback on mobile tap
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
    onTabChange(tabId);
  };

  const isAndroid = platform === 'android';

  return (
    <nav
      className={`${
        insideFrame ? 'sticky bottom-0 w-full' : 'fixed bottom-0 left-0 right-0 lg:hidden'
      } z-40 ${
        isAndroid
          ? 'bg-[#12151c]/95 border-t border-white/[0.08] px-3 pt-2 pb-2'
          : 'bg-dark-950/85 backdrop-blur-2xl border-t border-white/[0.07] px-2 pt-1.5 pb-2.5'
      }`}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.matchIds.includes(activeTab);

          if (isAndroid) {
            // Android Material You 3 Pill Indicator
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 relative transition-all"
              >
                <div
                  className={`relative flex items-center justify-center h-8 w-14 rounded-full transition-all ${
                    isActive
                      ? 'bg-purple-500/25 text-purple-300'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
                  {tab.badge && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-purple-400 text-black px-1 text-[9px] font-bold">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium tracking-tight ${
                    isActive ? 'text-purple-300 font-bold' : 'text-dark-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          // iOS 18 Cupertino Tab Item
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all ${
                isActive ? 'text-white' : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2.5 rounded-full bg-white text-black px-1 text-[9px] font-bold leading-tight">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Gesture Bars */}
      {insideFrame && (
        <div className="mt-2 flex justify-center">
          {isAndroid ? (
            /* Android Gesture Bar */
            <div className="h-1 w-20 rounded-full bg-white/40" />
          ) : (
            /* iOS Home Indicator */
            <div className="h-1 w-32 rounded-full bg-white/30" />
          )}
        </div>
      )}
    </nav>
  );
}
