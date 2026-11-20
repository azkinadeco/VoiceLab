'use client';

import React, { useState, useEffect } from 'react';
import { X, Monitor, Apple, Smartphone, Laptop, Check, Download, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from '@/lib/toast';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
}

export default function InstallModal({ isOpen, onClose, deferredPrompt }: InstallModalProps) {
  const [activeTab, setActiveTab] = useState<'windows' | 'macos' | 'ios' | 'android'>('windows');
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Detect user OS
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setActiveTab('ios');
      } else if (/android/.test(userAgent)) {
        setActiveTab('android');
      } else if (/macintosh|mac os x/.test(userAgent)) {
        setActiveTab('macos');
      } else if (/windows|win32/.test(userAgent)) {
        setActiveTab('windows');
      }

      // Check if already in standalone display mode
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        setIsInstalled(true);
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setInstalling(false);
    } else {
      toast('Untuk browser ini, silakan ikuti petunjuk manual di tab bawah sesuai sistem operasi Anda.', 'info');
    }
  };

  return (
    <div
      className="m-sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="m-sheet relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-dark-900 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-80 bg-brand-500/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 overflow-hidden rounded-xl border border-cyan-500/40 shadow-lg shadow-cyan-500/25 bg-dark-900 shrink-0">
              <img src="/icons/favicon.png" alt="Voice Lab" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold sm:font-semibold text-white">Install Voice Lab</h2>
              <p className="text-xs text-dark-400">Gunakan sebagai aplikasi Desktop atau Mobile mandiri</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dark-400 hover:bg-dark-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Native 1-Click Install Banner (if prompt available) */}
        {deferredPrompt && !isInstalled && (
          <div className="mx-4 sm:mx-6 mt-4 flex shrink-0 flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-brand-900/60 to-purple-900/60 border border-brand-500/40 p-4">
            <div>
              <h4 className="text-sm font-semibold text-white">1-Click Install Ready!</h4>
              <p className="text-xs text-brand-200 mt-0.5">Browser Anda mendukung instalasi langsung tanpa perantara.</p>
            </div>
            <button
              onClick={handleNativeInstall}
              disabled={installing}
              className="flex h-11 sm:h-auto items-center justify-center gap-2 rounded-2xl sm:rounded-lg bg-brand-500 px-4 py-2 text-sm sm:text-xs font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-400 transition-all shrink-0"
            >
              <Download className="h-4 w-4" />
              {installing ? 'Menginstall...' : 'Install Sekarang'}
            </button>
          </div>
        )}

        {isInstalled && (
          <div className="mx-4 sm:mx-6 mt-4 flex shrink-0 items-center gap-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 p-3 text-xs text-emerald-300">
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            Aplikasi sudah berjalan dalam mode standalone atau terinstall!
          </div>
        )}

        {/* Platform OS Tabs */}
        <div className="flex shrink-0 overflow-x-auto no-scrollbar border-b border-white/10 px-4 sm:px-6 pt-3 sm:pt-4 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('windows')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 pb-3 pt-1 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'windows'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-dark-400 hover:text-dark-200'
            }`}
          >
            <Laptop className="h-4 w-4 text-blue-400" />
            Windows
          </button>
          <button
            onClick={() => setActiveTab('macos')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 pb-3 pt-1 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'macos'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-dark-400 hover:text-dark-200'
            }`}
          >
            <Apple className="h-4 w-4 text-gray-300" />
            macOS
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 pb-3 pt-1 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'ios'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-dark-400 hover:text-dark-200'
            }`}
          >
            <Smartphone className="h-4 w-4 text-rose-400" />
            iOS (iPhone/iPad)
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-2 pb-3 pt-1 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'android'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-dark-400 hover:text-dark-200'
            }`}
          >
            <Smartphone className="h-4 w-4 text-emerald-400" />
            Android
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:max-h-[60vh]">
          {activeTab === 'windows' && (
            <div className="space-y-4 text-xs text-dark-300">
              <div className="rounded-xl bg-dark-950 p-4 border border-white/5 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-blue-400" />
                  Instalasi Desktop Windows (Edge / Chrome)
                </h3>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed text-dark-300">
                  <li>Buka website ini di <strong>Microsoft Edge</strong> atau <strong>Google Chrome</strong>.</li>
                  <li>Lihat di address bar sebelah kanan, klik ikon <strong>Install / Aplikasi</strong> (<span className="text-brand-300 font-mono">⊞</span>).</li>
                  <li>Klik <strong>Install</strong>. Voice Lab akan muncul sebagai aplikasi mandiri di Start Menu & Desktop!</li>
                </ol>
              </div>

              <div className="rounded-xl bg-dark-950 p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-white text-xs">Download Desktop Launcher (.bat)</h4>
                  <p className="text-[11px] text-dark-400 mt-0.5">Buka Voice Lab langsung di window khusus desktop tanpa tab browser</p>
                </div>
                <a
                  href="/scripts/VoiceLab-Windows.bat"
                  download="VoiceLab-Windows.bat"
                  className="flex h-11 sm:h-auto items-center justify-center gap-1.5 rounded-2xl sm:rounded-lg bg-dark-800 border border-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-dark-750 transition-colors shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  Download .bat
                </a>
              </div>
            </div>
          )}

          {activeTab === 'macos' && (
            <div className="space-y-4 text-xs text-dark-300">
              <div className="rounded-xl bg-dark-950 p-4 border border-white/5 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Apple className="h-4 w-4 text-gray-300" />
                  Instalasi macOS (Safari / Chrome)
                </h3>
                <div className="space-y-2.5">
                  <p className="font-medium text-dark-200">Cara 1 (Safari macOS Sonoma ke atas):</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-2 leading-relaxed text-dark-300">
                    <li>Di Safari, klik menu <strong>File</strong> di menu bar atas Mac.</li>
                    <li>Pilih <strong>Add to Dock...</strong> (Tambahkan ke Dock).</li>
                    <li>Voice Lab sekarang menjadi aplikasi asli di Dock & Launchpad macOS!</li>
                  </ol>

                  <p className="font-medium text-dark-200 pt-2">Cara 2 (Google Chrome / Edge):</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-2 leading-relaxed text-dark-300">
                    <li>Klik ikon <strong>Install</strong> di address bar kanan atas Chrome.</li>
                    <li>Pilih Install. App akan otomatis masuk ke folder Applications Mac.</li>
                  </ol>
                </div>
              </div>

              <div className="rounded-xl bg-dark-950 p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-white text-xs">Download Mac Launcher (.command)</h4>
                  <p className="text-[11px] text-dark-400 mt-0.5">Jalankan sekali klik untuk membuka window app khusus di Mac</p>
                </div>
                <a
                  href="/scripts/VoiceLab-Mac.command"
                  download="VoiceLab-Mac.command"
                  className="flex h-11 sm:h-auto items-center justify-center gap-1.5 rounded-2xl sm:rounded-lg bg-dark-800 border border-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-dark-750 transition-colors shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-purple-400" />
                  Download .command
                </a>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-4 text-xs text-dark-300">
              <div className="rounded-xl bg-dark-950 p-4 border border-white/5 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-rose-400" />
                  Instalasi di iPhone & iPad (iOS Safari)
                </h3>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed text-dark-300">
                  <li>Buka halaman ini menggunakan <strong>Safari</strong> di iPhone/iPad Anda.</li>
                  <li>Tap tombol <strong>Share</strong> (ikon kotak dengan panah mengarah ke atas di bar bawah).</li>
                  <li>Scroll ke bawah lalu pilih <strong>Add to Home Screen</strong> (Tambah ke Layar Utama).</li>
                  <li>Beri nama lalu tap <strong>Add</strong> di kanan atas.</li>
                  <li>Voice Lab akan muncul di Home Screen iPhone Anda dan berjalan layar penuh tanpa bar browser!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'android' && (
            <div className="space-y-4 text-xs text-dark-300">
              <div className="rounded-xl bg-dark-950 p-4 border border-white/5 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  Instalasi di Android (Chrome / Brave / Edge)
                </h3>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed text-dark-300">
                  <li>Buka website ini di <strong>Google Chrome</strong> di ponsel Android Anda.</li>
                  <li>Tap ikon menu titik tiga (<strong>⋮</strong>) di sudut kanan atas.</li>
                  <li>Pilih <strong>Install app</strong> atau <strong>Add to Home Screen</strong>.</li>
                  <li>Konfirmasi install. Aplikasi akan otomatis terpasang seperti aplikasi dari Play Store!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 sm:px-6 py-3 sm:py-3.5 bg-dark-950/60">
          <div className="hidden sm:block text-[11px] text-dark-400">
            PWA Standalone Engine • Zero Configuration
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto h-12 sm:h-auto rounded-2xl sm:rounded-lg bg-dark-800 px-4 py-1.5 text-sm sm:text-xs font-medium text-dark-200 hover:bg-dark-700 hover:text-white transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
