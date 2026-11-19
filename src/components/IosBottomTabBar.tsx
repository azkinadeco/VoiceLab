'use client';

import React from 'react';
import { Mic, Dna, AudioWaveform, Film, History } from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface IosBottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  totalGenerations?: number;
  insideFrame?: boolean;
}

export default function IosBottomTabBar({
  activeTab,
  onTabChange,
  totalGenerations = 0,
  insideFrame = false,
}: IosBottomTabBarProps) {
  const tabs = [
    {
      id: 'tts' as ActiveTab,
      matchIds: ['tts', 'batch'],
      label: 'Voiceover',
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
      label: 'Isolasi',
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
      label: 'Koleksi',
      icon: History,
      badge: totalGenerations > 0 ? totalGenerations : null,
    },
  ];

  return (
    <nav
      className={`${
        insideFrame ? 'sticky bottom-0 w-full' : 'fixed bottom-0 left-0 right-0 lg:hidden'
      } z-40 bg-dark-950/90 backdrop-blur-2xl border-t border-white/[0.08] px-2 pt-1.5 pb-3`}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.matchIds.includes(activeTab);
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
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

      {/* iOS Home Indicator Bar */}
      {insideFrame && (
        <div className="mt-2 flex justify-center">
          <div className="h-1 w-32 rounded-full bg-white/30" />
        </div>
      )}
    </nav>
  );
}
