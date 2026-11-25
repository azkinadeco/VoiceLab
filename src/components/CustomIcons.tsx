import React from 'react';

/**
 * Custom Multi-Color Vector Brand Logo for Voice Lab
 */
export function VoiceLabLogoIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="vl-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#131826" />
          <stop offset="100%" stopColor="#07090e" />
        </linearGradient>
        <linearGradient id="vl-wave" x1="6" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#vl-bg)" />
      <rect x="1" y="1" width="46" height="46" rx="12" stroke="url(#vl-wave)" strokeOpacity="0.45" strokeWidth="1.5" />
      {/* Acoustic Frequency Bars */}
      <rect x="9" y="20" width="3" height="8" rx="1.5" fill="url(#vl-wave)" opacity="0.75" />
      <rect x="14" y="15" width="3" height="18" rx="1.5" fill="url(#vl-wave)" opacity="0.9" />
      <rect x="19" y="10" width="3.5" height="28" rx="1.75" fill="url(#vl-wave)" />
      <rect x="25.5" y="10" width="3.5" height="28" rx="1.75" fill="url(#vl-wave)" />
      <rect x="31" y="15" width="3" height="18" rx="1.5" fill="url(#vl-wave)" opacity="0.9" />
      <rect x="36" y="20" width="3" height="8" rx="1.5" fill="url(#vl-wave)" opacity="0.75" />
      {/* Center Diamond Core */}
      <circle cx="24" cy="24" r="5" fill="#0b0e17" stroke="#22d3ee" strokeWidth="1.5" />
      <path d="M24 20.5L25.2 22.8L27.5 24L25.2 25.2L24 27.5L22.8 25.2L20.5 24L22.8 22.8L24 20.5Z" fill="#ffffff" />
    </svg>
  );
}

/**
 * Custom Vector Icons for TTS Engines (Auto, Gemini, ElevenLabs, FreeTTS, VOICEVOX)
 * Replaces basic emojis (✨, 🎙️, ⚡, 🎌) with crisp vector artwork.
 */
export function EngineBadgeIcon({
  engine,
  className = 'h-3.5 w-3.5',
}: {
  engine: 'auto' | 'gemini-tts' | 'elevenlabs-api' | 'freetts-api' | 'voicevox' | 'gemini' | 'elevenlabs' | 'freetts';
  className?: string;
}) {
  if (engine === 'gemini-tts' || engine === 'gemini') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={className}>
        <defs>
          <linearGradient id="gem-g" x1="2" y1="2" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <path
          d="M10 1.5C10.5 6.2 13.8 9.5 18.5 10C13.8 10.5 10.5 13.8 10 18.5C9.5 13.8 6.2 10.5 1.5 10C6.2 9.5 9.5 6.2 10 1.5Z"
          fill="url(#gem-g)"
        />
        <circle cx="15.5" cy="4.5" r="1.3" fill="#34d399" />
      </svg>
    );
  }

  if (engine === 'elevenlabs-api' || engine === 'elevenlabs') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={className}>
        <defs>
          <linearGradient id="el-g" x1="2" y1="2" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="16" height="16" rx="5" fill="url(#el-g)" fillOpacity="0.2" stroke="url(#el-g)" strokeWidth="1.4" />
        <rect x="6.5" y="5.5" width="2.4" height="9" rx="1.2" fill="url(#el-g)" />
        <rect x="11.1" y="5.5" width="2.4" height="9" rx="1.2" fill="url(#el-g)" />
      </svg>
    );
  }

  if (engine === 'freetts-api' || engine === 'freetts') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={className}>
        <defs>
          <linearGradient id="ft-g" x1="3" y1="2" x2="17" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <path
          d="M11.2 2L4.2 11.2H9.6L8.8 18L15.8 8.8H10.4L11.2 2Z"
          fill="url(#ft-g)"
          stroke="url(#ft-g)"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (engine === 'voicevox') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={className}>
        <defs>
          <linearGradient id="vv-g" x1="2" y1="2" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle cx="10" cy="10" r="8" fill="url(#vv-g)" fillOpacity="0.2" stroke="url(#vv-g)" strokeWidth="1.5" />
        <path d="M6.2 7.2L10 13.8L13.8 7.2" stroke="url(#vv-g)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // 'auto'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="10" cy="10" r="3.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Custom Vector Badges for Voice Accents & Categories
 * Replaces all OS flag & symbol emojis (🇮🇩, 🎌, 🎙️, 🇺🇸, 🇬🇧, 🇦🇺, 🇯🇵, 🇰🇷, 🇸🇦, 🇨🇳, 🇪🇺, 🌐, ⭐, 🧬)
 */
export function AccentBadgeIcon({ id, className = 'h-3.5 w-3.5' }: { id: string; className?: string }) {
  switch (id) {
    case 'Indonesian':
      return (
        <svg viewBox="0 0 20 20" className={className}>
          <clipPath id="id-clip">
            <circle cx="10" cy="10" r="8.5" />
          </clipPath>
          <g clipPath="url(#id-clip)">
            <rect x="1" y="1" width="18" height="9" fill="#ef4444" />
            <rect x="1" y="10" width="18" height="9" fill="#f8fafc" />
          </g>
          <circle cx="10" cy="10" r="8.5" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
        </svg>
      );

    case 'Indonesian (Jawa)':
      // Golden Batik / Gunungan Crest
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#78350f" stroke="#f59e0b" strokeWidth="1.3" />
          <path d="M10 4L14.5 11.5L10 15.5L5.5 11.5L10 4Z" fill="#fbbf24" />
          <circle cx="10" cy="10.5" r="1.6" fill="#78350f" />
        </svg>
      );

    case 'Indonesian (Sunda)':
      // Emerald Parahyangan Leaf / Mountain Crest
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#064e3b" stroke="#10b981" strokeWidth="1.3" />
          <path d="M5 13.5L9 7.5L12 11.5L14 9L16 13.5H5Z" fill="#34d399" />
        </svg>
      );

    case 'Anime JP':
      // Custom Sakura / Neon Anime Star Emblem
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <defs>
            <linearGradient id="anime-g" x1="2" y1="2" x2="18" y2="18" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
          <circle cx="10" cy="10" r="8.5" fill="url(#anime-g)" fillOpacity="0.22" stroke="url(#anime-g)" strokeWidth="1.3" />
          <path
            d="M10 4.2L11.6 8.2L15.8 8.6L12.6 11.4L13.6 15.5L10 13.3L6.4 15.5L7.4 11.4L4.2 8.6L8.4 8.2L10 4.2Z"
            fill="url(#anime-g)"
          />
        </svg>
      );

    case 'ElevenLabs':
      return <EngineBadgeIcon engine="elevenlabs" className={className} />;

    case 'American':
    case 'British':
    case 'Australian':
      // Crisp Vector Anglosphere Badge
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.2" />
          <path d="M3 10H17M10 3V17" stroke="#ef4444" strokeWidth="2.4" />
          <path d="M4.5 4.5L15.5 15.5M15.5 4.5L4.5 15.5" stroke="#93c5fd" strokeWidth="1.3" />
        </svg>
      );

    case 'Japanese':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#f8fafc" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
          <circle cx="10" cy="10" r="4.2" fill="#e11d48" />
        </svg>
      );

    case 'Korean':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#f8fafc" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
          <path d="M6 10A4 4 0 0 1 14 10Z" fill="#e11d48" />
          <path d="M6 10A4 4 0 0 0 14 10Z" fill="#2563eb" />
        </svg>
      );

    case 'Arabic':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#065f46" stroke="#34d399" strokeWidth="1.2" />
          <path d="M11.8 6.5A4 4 0 1 0 11.8 13.5A3.2 3.2 0 1 1 11.8 6.5Z" fill="#fbbf24" />
        </svg>
      );

    case 'Mandarin':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#b91c1c" stroke="#f87171" strokeWidth="1.2" />
          <path d="M7.5 6L8.4 8.2L10.8 8.4L9 10L9.5 12.3L7.5 11L5.5 12.3L6 10L4.2 8.4L6.6 8.2L7.5 6Z" fill="#facc15" />
        </svg>
      );

    case 'favorites':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <path
            d="M10 2.5L12.3 7.2L17.5 7.9L13.7 11.5L14.6 16.7L10 14.2L5.4 16.7L6.3 11.5L2.5 7.9L7.7 7.2L10 2.5Z"
            fill="#fbbf24"
          />
        </svg>
      );

    case 'cloned':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8.5" fill="#3b0764" stroke="#c084fc" strokeWidth="1.2" />
          <path d="M6.5 6C6.5 9 13.5 11 13.5 14M13.5 6C13.5 9 6.5 11 6.5 14" stroke="#e879f9" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    default:
      // 'all' / 'European' / Globe
      return (
        <svg viewBox="0 0 20 20" fill="none" className={className}>
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
          <ellipse cx="10" cy="10" rx="3.8" ry="8" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2.5 10H17.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
  }
}
