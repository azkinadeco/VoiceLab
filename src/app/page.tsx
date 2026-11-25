'use client';

import React, { useState, useEffect } from 'react';
import Sidebar, { ActiveTab } from '@/components/Sidebar';
import Header from '@/components/Header';
import MobileBottomNav from '@/components/MobileBottomNav';
import MoreSheet from '@/components/MoreSheet';
import Toaster from '@/components/Toaster';
import MobileVoiceSheetModal from '@/components/MobileVoiceSheetModal';
import TextToSpeech from '@/components/TextToSpeech';
import VoiceLab from '@/components/VoiceLab';
import SpeechToSpeech from '@/components/SpeechToSpeech';
import SoundEffects from '@/components/SoundEffects';
import VoiceIsolator from '@/components/VoiceIsolator';
import StudioDubbing from '@/components/StudioDubbing';
import ConversationalAI from '@/components/ConversationalAI';
import ProjectsReader from '@/components/ProjectsReader';
import BatchGenerator from '@/components/BatchGenerator';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import HistoryPanel from '@/components/HistoryPanel';
import VoiceSelectorModal from '@/components/VoiceSelectorModal';
import InstallModal from '@/components/InstallModal';
import SettingsModal from '@/components/SettingsModal';
import PronunciationModal from '@/components/PronunciationModal';
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer';
import CommandPaletteModal from '@/components/CommandPaletteModal';
import AudioTrimmerModal from '@/components/AudioTrimmerModal';
import { Voice, Generation } from '@/lib/types';
import { PRESET_VOICES } from '@/lib/voices-data';
import { Monitor, Smartphone, Wifi, Battery, Download } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tts');
  const [voices, setVoices] = useState<Voice[]>(PRESET_VOICES);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(PRESET_VOICES[0]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [activeGlobalTrack, setActiveGlobalTrack] = useState<Generation | null>(null);
  const [autoPlayGlobalTrack, setAutoPlayGlobalTrack] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [devicePreviewMode, setDevicePreviewMode] = useState<'desktop' | 'iphone' | 'android'>('desktop');
  const [isMobileVoiceSheetOpen, setIsMobileVoiceSheetOpen] = useState<boolean>(false);
  const [isAndroidUser, setIsAndroidUser] = useState<boolean>(false);
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);

  // Modals state
  const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPronunciationOpen, setIsPronunciationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOled, setIsOled] = useState(false);
  const [reuseGen, setReuseGen] = useState<Generation | null>(null);

  const [trimmerState, setTrimmerState] = useState<{
    isOpen: boolean;
    url: string | null;
    duration: number;
    fileName: string;
  }>({
    isOpen: false,
    url: null,
    duration: 0,
    fileName: 'audio.mp3',
  });

  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // PWA install prompt handler
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Global Cmd + K shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Load saved OLED mode
    const savedOled = localStorage.getItem('voicelab_oled') === 'true';
    setIsOled(savedOled);
    if (savedOled) {
      document.body.classList.add('oled-black');
    }

    // Detect real Android device
    if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) {
      setIsAndroidUser(true);
    }

    // Deep link: /?tab=studio (used by PWA shortcuts & screenshots)
    const tabParam = new URLSearchParams(window.location.search).get('tab') as ActiveTab | null;
    const validTabs: ActiveTab[] = ['tts', 'voicelab', 'speech2speech', 'sfx', 'isolator', 'studio', 'agents', 'projects', 'batch', 'analytics', 'history'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }

    refreshAllData();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleOledTheme = () => {
    const next = !isOled;
    setIsOled(next);
    localStorage.setItem('voicelab_oled', String(next));
    if (next) {
      document.body.classList.add('oled-black');
    } else {
      document.body.classList.remove('oled-black');
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't hijack swipes that start inside horizontal scrollers, sliders or text fields
    const target = e.target as HTMLElement;
    if (target.closest('.overflow-x-auto, input, textarea, select, [data-no-swipe]')) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Detect horizontal swipe with minimum threshold and angle check
    if (Math.abs(deltaX) > 65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      const hubs: ActiveTab[] = ['tts', 'speech2speech', 'voicelab', 'history'];
      const currentIndex = hubs.indexOf(activeTab);
      if (currentIndex !== -1) {
        if (deltaX < 0 && currentIndex < hubs.length - 1) {
          // Swipe Left -> Next Tab
          setActiveTab(hubs[currentIndex + 1]);
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe Right -> Prev Tab
          setActiveTab(hubs[currentIndex - 1]);
        }
      }
    }
  };

  const handleReuseGeneration = (gen: Generation) => {
    setReuseGen(gen);
    const matchingVoice = voices.find((v) => v.id === gen.voiceId);
    if (matchingVoice) {
      setSelectedVoice(matchingVoice);
    }
    setActiveTab('tts');
  };

  const refreshAllData = () => {
    loadVoices();
    loadHistory();
    loadSettings();
  };

  const loadVoices = async () => {
    try {
      const res = await fetch('/api/voices');
      const data = await res.json();
      if (data.voices && data.voices.length > 0) {
        setVoices(data.voices);
        setSelectedVoice((prev) => {
          const match = data.voices.find((v: Voice) => v.id === prev.id);
          return match || data.voices[0];
        });
      }
    } catch (e) {
      console.error('Error loading voices:', e);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.generations) {
        setGenerations(data.generations);
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.stats) {
        setStorageStats(data.stats);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const handleVoiceCreated = (newVoice: Voice) => {
    setVoices((prev) => [newVoice, ...prev]);
    setSelectedVoice(newVoice);
    loadSettings();
  };

  const handleVoiceDeleted = async (id: string) => {
    try {
      const res = await fetch(`/api/voices?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVoices((prev) => prev.filter((v) => v.id !== id));
        if (selectedVoice.id === id) {
          setSelectedVoice(PRESET_VOICES[0]);
        }
        loadSettings();
      }
    } catch (e) {
      console.error('Error deleting voice:', e);
    }
  };

  const handleGenerationCreated = (newGen: Generation) => {
    setGenerations((prev) => [newGen, ...prev]);
    setAutoPlayGlobalTrack(false);
    setActiveGlobalTrack(newGen);
    loadSettings();
  };

  const handleDeleteGeneration = async (id: string) => {
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGenerations((prev) => prev.filter((g) => g.id !== id));
        if (activeGlobalTrack?.id === id) {
          setActiveGlobalTrack(null);
        }
        loadSettings();
      }
    } catch (e) {
      console.error('Error deleting generation:', e);
    }
  };

  const handleToggleStar = async (id: string) => {
    try {
      const res = await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setGenerations((prev) =>
          prev.map((g) => (g.id === id ? { ...g, starred: data.starred } : g))
        );
      }
    } catch (e) {
      console.error('Error toggling star:', e);
    }
  };

  const customVoices = voices.filter((v) => v.category === 'cloned' || v.category === 'designed');

  const openTrimmer = (url: string, duration: number, fileName = 'audio.mp3') =>
    setTrimmerState({ isOpen: true, url, duration, fileName });

  const renderMoreSheet = (insideFrame: boolean) => (
    <MoreSheet
      isOpen={isMoreOpen}
      onClose={() => setIsMoreOpen(false)}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onOpenPronunciation={() => setIsPronunciationOpen(true)}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onOpenInstall={() => setIsInstallModalOpen(true)}
      isOled={isOled}
      onToggleOled={toggleOledTheme}
      diskUsage={storageStats?.diskUsageFormatted}
      insideFrame={insideFrame}
    />
  );

  const renderActiveView = (inMobile = false) => (
    <>
      {activeTab === 'tts' && (
        <TextToSpeech
          voices={voices}
          selectedVoice={selectedVoice}
          onSelectVoice={setSelectedVoice}
          onOpenVoiceSelector={() => {
            if (inMobile || (typeof window !== 'undefined' && window.innerWidth < 768)) {
              setIsMobileVoiceSheetOpen(true);
            } else {
              setIsVoiceSelectorOpen(true);
            }
          }}
          onOpenPronunciation={() => setIsPronunciationOpen(true)}
          onGenerationCreated={handleGenerationCreated}
          isIphoneMode={inMobile}
          loadedGeneration={reuseGen}
          onOpenTrimmer={openTrimmer}
        />
      )}

      {activeTab === 'voicelab' && (
        <VoiceLab
          customVoices={customVoices}
          onVoiceCreated={handleVoiceCreated}
          onVoiceDeleted={handleVoiceDeleted}
          onSelectForTTS={(voice) => {
            setSelectedVoice(voice);
            setActiveTab('tts');
          }}
        />
      )}

      {activeTab === 'agents' && (
        <ConversationalAI
          voices={voices}
          onGenerationCreated={handleGenerationCreated}
        />
      )}

      {activeTab === 'studio' && (
        <StudioDubbing
          voices={voices}
          onGenerationCreated={handleGenerationCreated}
        />
      )}

      {activeTab === 'projects' && (
        <ProjectsReader
          voices={voices}
          onGenerationCreated={handleGenerationCreated}
        />
      )}

      {activeTab === 'batch' && (
        <BatchGenerator
          voices={voices}
          onGenerationCreated={handleGenerationCreated}
        />
      )}

      {activeTab === 'speech2speech' && (
        <SpeechToSpeech
          voices={voices}
          onGenerationCreated={handleGenerationCreated}
        />
      )}

      {activeTab === 'sfx' && (
        <SoundEffects onGenerationCreated={handleGenerationCreated} />
      )}

      {activeTab === 'isolator' && (
        <VoiceIsolator onGenerationCreated={handleGenerationCreated} />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard
          generations={generations}
          storageStats={storageStats}
          onRefreshAll={refreshAllData}
        />
      )}

      {activeTab === 'history' && (
        <HistoryPanel
          generations={generations}
          onDeleteGeneration={handleDeleteGeneration}
          onToggleStar={handleToggleStar}
          onRefresh={loadHistory}
          onReuseGeneration={handleReuseGeneration}
          onOpenTrimmer={openTrimmer}
        />
      )}
    </>
  );

  return (
    <div className="min-h-dvh-screen bg-dark-950 text-white">
      <Toaster />
      {devicePreviewMode !== 'desktop' ? (
        /* INTERACTIVE SMARTPHONE SIMULATOR VIEW (iPhone 16 Pro vs Android Galaxy S25) */
        <div className="min-h-screen flex flex-col items-center justify-center p-3 sm:p-4 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
          {/* Top Switcher Bar outside Hardware Frame */}
          <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-center gap-2 rounded-full bg-dark-900/90 border border-white/10 px-3 py-1.5 shadow-2xl">
            <button
              onClick={() => setDevicePreviewMode('desktop')}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-dark-300 hover:text-white transition-colors"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Desktop</span>
            </button>
            <div className="h-3.5 w-[1px] bg-white/15" />
            <button
              onClick={() => setDevicePreviewMode('iphone')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                devicePreviewMode === 'iphone'
                  ? 'bg-white text-black shadow font-bold'
                  : 'text-dark-300 hover:text-white'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>iPhone 16 Pro</span>
            </button>
            <button
              onClick={() => setDevicePreviewMode('android')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                devicePreviewMode === 'android'
                  ? 'bg-purple-400 text-black shadow font-bold'
                  : 'text-dark-300 hover:text-white'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 text-purple-600" />
              <span>Android Galaxy S25</span>
            </button>
            <div className="h-3.5 w-[1px] bg-white/15" />
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1 text-xs font-medium text-white"
            >
              <Download className="h-3 w-3" />
              <span>Pasang di HP</span>
            </button>
          </div>

          {/* Conditional Hardware Frame: iPhone vs Android */}
          {devicePreviewMode === 'iphone' ? (
            /* iPhone 16 Pro Titanium Bezel + Dynamic Island */
            <div className="iphone-frame" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              {/* iOS Status Bar + Dynamic Island */}
              <div className="flex items-center justify-between px-6 pt-3 pb-2 bg-dark-950 select-none shrink-0">
                <span className="text-xs font-bold text-white tracking-tight">9:41</span>
                <div className="h-6 w-24 rounded-full bg-black border border-white/[0.08] flex items-center justify-end pr-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-950 border border-indigo-500/30" />
                </div>
                <div className="flex items-center gap-1.5 text-white">
                  <Wifi className="h-3.5 w-3.5" />
                  <Battery className="h-4 w-4" />
                </div>
              </div>

              {/* iOS Compact Top Navigation */}
              <Header
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onOpenMobileMenu={() => {}}
                onOpenInstall={() => setIsInstallModalOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenPronunciation={() => setIsPronunciationOpen(true)}
                storageStats={storageStats}
                devicePreviewMode={devicePreviewMode}
                onSetDevicePreviewMode={setDevicePreviewMode}
                onOpenSpotlight={() => setIsCommandPaletteOpen(true)}
                isOled={isOled}
                onToggleOledTheme={toggleOledTheme}
                insideFrame
              />

              {/* iOS Scrollable App Content */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4 no-scrollbar">
                {renderActiveView(true)}
              </div>

              {/* Floating Audio Pill inside iPhone */}
              <GlobalAudioPlayer
                activeTrack={activeGlobalTrack}
                playlist={generations}
                autoPlayOnLoad={autoPlayGlobalTrack}
                insideIphoneFrame
                onSelectTrack={(track) => {
                  setAutoPlayGlobalTrack(true);
                  setActiveGlobalTrack(track);
                }}
                onClose={() => setActiveGlobalTrack(null)}
              />

              {/* Native iOS 5-Tab Bottom Bar */}
              <MobileBottomNav
                activeTab={activeTab}
                onTabChange={setActiveTab}
                platform="ios"
                totalGenerations={storageStats?.totalGenerations || generations.length}
                insideFrame
                onOpenMore={() => setIsMoreOpen(true)}
                isMoreOpen={isMoreOpen}
              />
              {renderMoreSheet(true)}
            </div>
          ) : (
            /* Android Galaxy S25 / Pixel 9 Material You 3 Frame + Punch Hole Camera */
            <div className="android-frame" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              {/* Android Status Bar + Center Punch Hole */}
              <div className="flex items-center justify-between px-5 pt-2.5 pb-2 bg-[#0d0f14] select-none shrink-0 border-b border-white/[0.04]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 tracking-tight">
                  <span>10:00</span>
                </div>
                {/* Center Punch Hole Camera */}
                <div className="h-3.5 w-3.5 rounded-full bg-black ring-1 ring-white/10 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-950/80" />
                </div>
                {/* Right: 5G & Battery Percentage */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <span className="text-[10px] font-bold font-mono text-zinc-400">5G</span>
                  <span className="text-[10px] font-medium">98%</span>
                  <Battery className="h-3.5 w-3.5 text-zinc-200" />
                </div>
              </div>

              {/* Android Compact Top Navigation */}
              <Header
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onOpenMobileMenu={() => {}}
                onOpenInstall={() => setIsInstallModalOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenPronunciation={() => setIsPronunciationOpen(true)}
                storageStats={storageStats}
                devicePreviewMode={devicePreviewMode}
                onSetDevicePreviewMode={setDevicePreviewMode}
                onOpenSpotlight={() => setIsCommandPaletteOpen(true)}
                isOled={isOled}
                onToggleOledTheme={toggleOledTheme}
                insideFrame
              />

              {/* Android Scrollable App Content */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4 no-scrollbar">
                {renderActiveView(true)}
              </div>

              {/* Floating Audio Pill inside Android */}
              <GlobalAudioPlayer
                activeTrack={activeGlobalTrack}
                playlist={generations}
                autoPlayOnLoad={autoPlayGlobalTrack}
                insideIphoneFrame
                onSelectTrack={(track) => {
                  setAutoPlayGlobalTrack(true);
                  setActiveGlobalTrack(track);
                }}
                onClose={() => setActiveGlobalTrack(null)}
              />

              {/* Native Android Material You 3 Bottom Nav */}
              <MobileBottomNav
                activeTab={activeTab}
                onTabChange={setActiveTab}
                platform="android"
                totalGenerations={storageStats?.totalGenerations || generations.length}
                insideFrame
                onOpenMore={() => setIsMoreOpen(true)}
                isMoreOpen={isMoreOpen}
              />
              {renderMoreSheet(true)}
            </div>
          )}
        </div>
      ) : (
        /* STANDARD RESPONSIVE DESKTOP & MOBILE VIEW */
        <div
          className="flex min-h-screen"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Desktop Left Sidebar (5 Hubs) */}
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenInstall={() => setIsInstallModalOpen(true)}
            storageStats={storageStats}
            isOpenMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            devicePreviewMode={devicePreviewMode}
            onSetDevicePreviewMode={setDevicePreviewMode}
            isIphonePreview={false}
            onToggleIphonePreview={() => setDevicePreviewMode('iphone')}
          />

          {/* Main Workspace */}
          <div
            className={`flex-1 transition-all duration-300 ${
              isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-56'
            } flex flex-col min-w-0 mobile-content-pad`}
          >
            <Header
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
              onOpenInstall={() => setIsInstallModalOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenPronunciation={() => setIsPronunciationOpen(true)}
              storageStats={storageStats}
              devicePreviewMode={devicePreviewMode}
              onSetDevicePreviewMode={setDevicePreviewMode}
              isIphonePreview={false}
              onToggleIphonePreview={() => setDevicePreviewMode('iphone')}
              onOpenSpotlight={() => setIsCommandPaletteOpen(true)}
              isOled={isOled}
              onToggleOledTheme={toggleOledTheme}
            />

            <main className="flex-1 px-3 pt-3 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
              {renderActiveView(false)}
            </main>
          </div>

          {/* Floating Compact Glass Audio Pill */}
          <GlobalAudioPlayer
            activeTrack={activeGlobalTrack}
            playlist={generations}
            autoPlayOnLoad={autoPlayGlobalTrack}
            onSelectTrack={(track) => {
              setAutoPlayGlobalTrack(true);
              setActiveGlobalTrack(track);
            }}
            onClose={() => setActiveGlobalTrack(null)}
          />

          {/* Mobile / Real Smartphone Native Bottom Nav (Auto-detects iOS vs Android) */}
          <MobileBottomNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            platform={isAndroidUser ? 'android' : 'ios'}
            totalGenerations={storageStats?.totalGenerations || generations.length}
            onOpenMore={() => setIsMoreOpen(true)}
            isMoreOpen={isMoreOpen}
          />
          {renderMoreSheet(false)}
        </div>
      )}

      {/* Modals */}
      <MobileVoiceSheetModal
        isOpen={isMobileVoiceSheetOpen}
        onClose={() => setIsMobileVoiceSheetOpen(false)}
        voices={voices}
        selectedVoiceId={selectedVoice.id}
        onSelectVoice={(v) => {
          setSelectedVoice(v);
          setIsMobileVoiceSheetOpen(false);
        }}
        platform={devicePreviewMode === 'android' ? 'android' : 'ios'}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={setActiveTab}
        voices={voices}
        onSelectVoice={setSelectedVoice}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPronunciation={() => setIsPronunciationOpen(true)}
        onToggleIphone={() => setDevicePreviewMode(devicePreviewMode === 'desktop' ? 'iphone' : 'desktop')}
        onSelectDeviceMode={setDevicePreviewMode}
        onToggleOledTheme={toggleOledTheme}
        isOled={isOled}
      />

      <AudioTrimmerModal
        isOpen={trimmerState.isOpen}
        onClose={() => setTrimmerState({ isOpen: false, url: null, duration: 0, fileName: 'audio.mp3' })}
        audioUrl={trimmerState.url}
        duration={trimmerState.duration}
        fileName={trimmerState.fileName}
        onTrimSaved={(newUrl, newDur) => {
          loadHistory();
          loadSettings();
        }}
      />

      <VoiceSelectorModal
        isOpen={isVoiceSelectorOpen}
        onClose={() => setIsVoiceSelectorOpen(false)}
        voices={voices}
        selectedVoiceId={selectedVoice.id}
        onSelectVoice={setSelectedVoice}
        onOpenVoiceLab={() => {
          setIsVoiceSelectorOpen(false);
          setActiveTab('voicelab');
        }}
      />

      <PronunciationModal
        isOpen={isPronunciationOpen}
        onClose={() => setIsPronunciationOpen(false)}
      />

      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={refreshAllData}
      />
    </div>
  );
}
