'use client';

import React from 'react';
import { Mic, Dna, Film, History, LayoutGrid } from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { haptic } from '@/lib/haptics';

export type MobilePlatform = 'ios' | 'android';

/** Screens that live under the "Lainnya" (More) tab. */
export const MORE_TAB_IDS: ActiveTab[] = ['speech2speech', 'isolator', 'sfx', 'agents'];

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenMore: () => void;
  isMoreOpen?: boolean;
  platform?: MobilePlatform;
  totalGenerations?: number;
  insideFrame?: boolean;
}

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenMore,
  isMoreOpen = false,
  platform = 'ios',
  totalGenerations = 0,
  insideFrame = false,
}: MobileBottomNavProps) {
  const tabs: {
    id: ActiveTab | 'more';
    matchIds: ActiveTab[];
    label: string;
    icon: typeof Mic;
    badge?: number | null;
  }[] = [
    { id: 'tts', matchIds: ['tts', 'batch'], label: 'Voiceover', icon: Mic },
    { id: 'voicelab', matchIds: ['voicelab'], label: 'Kloning', icon: Dna },
    { id: 'studio', matchIds: ['studio', 'projects'], label: 'Studio', icon: Film },
    {
      id: 'history',
      matchIds: ['history', 'analytics'],
      label: 'Koleksi',
      icon: History,
      badge: totalGenerations > 0 ? totalGenerations : null,
    },
    { id: 'more', matchIds: MORE_TAB_IDS, label: 'Lainnya', icon: LayoutGrid },
  ];

  const handleTabClick = (tabId: ActiveTab | 'more') => {
    haptic(10);
    if (tabId === 'more') onOpenMore();
    else onTabChange(tabId);
  };

  const isAndroid = platform === 'android';
  const formatBadge = (n: number) => (n > 99 ? '99+' : String(n));

  return (
    <nav
      aria-label="Navigasi utama"
      className={`${
        insideFrame ? 'relative w-full shrink-0' : 'fixed bottom-0 left-0 right-0 lg:hidden'
      } z-40 border-t ${
        isAndroid ? 'bg-[#12151c]/95 border-white/[0.08]' : 'bg-dark-950/80 backdrop-blur-2xl border-white/[0.07]'
      }`}
      style={insideFrame ? undefined : { paddingBottom: 'var(--sab)' }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5" style={{ height: 'var(--tabbar-h)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === 'more' ? isMoreOpen || tab.matchIds.includes(activeTab) : tab.matchIds.includes(activeTab);

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                isAndroid
                  ? isActive
                    ? 'text-purple-300'
                    : 'text-dark-400'
                  : isActive
                  ? 'text-white'
                  : 'text-dark-500'
              }`}
            >
              <div
                className={`relative flex items-center justify-center transition-all ${
                  isAndroid ? `h-7 w-14 rounded-full ${isActive ? 'bg-purple-500/25' : ''}` : 'h-7 w-7'
                }`}
              >
                <Icon className={`h-[22px] w-[22px] ${isActive ? 'stroke-[2.3px]' : 'stroke-[1.7px]'}`} />
                {tab.badge ? (
                  <span
                    className={`absolute -top-1 left-1/2 ml-1.5 min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold leading-[16px] ${
                      isAndroid ? 'bg-purple-400 text-black' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {formatBadge(tab.badge)}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10.5px] tracking-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Home indicator / gesture bar (simulator only — real phones draw their own) */}
      {insideFrame && (
        <div className="flex justify-center pb-2 pt-1">
          <div className={`h-1 rounded-full ${isAndroid ? 'w-20 bg-white/40' : 'w-32 bg-white/30'}`} />
        </div>
      )}
    </nav>
  );
}
