import { NextRequest, NextResponse } from 'next/server';
import { saveAudioFile, addCustomVoice } from '@/lib/storage';
import { Voice } from '@/lib/types';

function createClonedOrbSvg(name: string, gender: string, customGradient?: string, customEmoji?: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CL';
  let c1 = gender === 'female' ? '#ec4899' : '#6366f1';
  let c2 = gender === 'female' ? '#9d174d' : '#3730a3';

  if (customGradient) {
    if (customGradient === 'sunset') { c1 = '#f97316'; c2 = '#db2777'; }
    else if (customGradient === 'emerald') { c1 = '#10b981'; c2 = '#047857'; }
    else if (customGradient === 'cyan') { c1 = '#06b6d4'; c2 = '#0284c7'; }
    else if (customGradient === 'amber') { c1 = '#f59e0b'; c2 = '#b45309'; }
    else if (customGradient === 'titanium') { c1 = '#94a3b8'; c2 = '#334155'; }
    else if (customGradient === 'purple') { c1 = '#a855f7'; c2 = '#6b21a8'; }
  }

  const centerContent = customEmoji
    ? `<text x="60" y="70" text-anchor="middle" font-size="32">${customEmoji}</text>`
    : `<text x="60" y="68" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700" font-size="28">${initials}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="g" cx="30%" cy="25%" r="75%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></radialGradient></defs><circle cx="60" cy="60" r="58" fill="url(#g)"/>${centerContent}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      category = 'cloned',
      gender = 'male',
      accent = 'Indonesian',
      description = '',
      audioBase64,
      age = 'young',
      labels = {},
      avatarGradient,
      avatarEmoji,
      estimatedPitchHz,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Voice name is required' }, { status: 400 });
    }

    const voiceId = `${category === 'designed' ? 'design' : 'clone'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let previewUrl = '';

    if (audioBase64 && typeof audioBase64 === 'string') {
      const mimeMatch = audioBase64.match(/^data:audio\/([\w.+-]+)/);
      const mimeSub = (mimeMatch?.[1] || '').toLowerCase();
      const b64Idx = audioBase64.indexOf('base64,');
      const base64Data = b64Idx >= 0 ? audioBase64.slice(b64Idx + 7) : audioBase64;
      const audioBuffer = Buffer.from(base64Data, 'base64');
      if (audioBuffer.length > 64) {
        const isWav = audioBuffer.slice(0, 4).toString('ascii') === 'RIFF' || mimeSub.includes('wav');
        const ext = isWav ? 'wav' : mimeSub.includes('webm') ? 'webm' : mimeSub.includes('ogg') ? 'ogg' : 'mp3';
        const filename = `${voiceId}-sample.${ext}`;
        const saved = await saveAudioFile(audioBuffer, 'voices', filename);
        previewUrl = saved.relativeUrl;
      }
    }

    // Map accent & gender to optimal neural acoustic profile
    const accLower = accent.toLowerCase();
    let baseVoiceId = 'id-ID-ArdiNeural';
    if (accLower.includes('jawa')) {
      baseVoiceId = gender === 'female' ? 'jv-ID-SitiNeural' : 'jv-ID-DimasNeural';
    } else if (accLower.includes('sunda')) {
      baseVoiceId = gender === 'female' ? 'su-ID-TutiNeural' : 'su-ID-JajangNeural';
    } else if (accLower.includes('indonesia')) {
      baseVoiceId = gender === 'female' ? 'id-ID-GadisNeural' : 'id-ID-ArdiNeural';
    } else if (accLower.includes('british') || accLower.includes('uk')) {
      baseVoiceId = gender === 'female' ? 'en-GB-SoniaNeural' : 'en-GB-RyanNeural';
    } else if (accLower.includes('australian')) {
      baseVoiceId = gender === 'female' ? 'en-AU-NatashaNeural' : 'en-AU-WilliamNeural';
    } else if (accLower.includes('japanese')) {
      baseVoiceId = gender === 'female' ? 'ja-JP-NanamiNeural' : 'ja-JP-KeitaNeural';
    } else if (accLower.includes('korean')) {
      baseVoiceId = gender === 'female' ? 'ko-KR-SunHiNeural' : 'ko-KR-InJoonNeural';
    } else if (accLower.includes('arabic')) {
      baseVoiceId = gender === 'female' ? 'ar-SA-ZariyahNeural' : 'ar-SA-HamedNeural';
    } else {
      baseVoiceId = gender === 'female' ? 'en-US-JennyNeural' : 'en-US-ChristopherNeural';
    }

    const avatarUrl = createClonedOrbSvg(name, gender, avatarGradient, avatarEmoji);

    // Compute subtle pitch offset from analyzed fundamental frequency (Hz)
    let pitchOffset = 0;
    if (typeof estimatedPitchHz === 'number' && estimatedPitchHz > 60 && estimatedPitchHz < 350) {
      const refHz = gender === 'female' ? 205 : 130;
      pitchOffset = Math.max(-12, Math.min(12, Math.round((estimatedPitchHz - refHz) / 8)));
    } else if (age === 'old') {
      pitchOffset = -4;
    } else if (age === 'young') {
      pitchOffset = 2;
    }

    const newVoice: Voice = {
      id: voiceId,
      name: name.trim(),
      category: category === 'designed' ? 'designed' : 'cloned',
      gender: gender as any,
      accent,
      language: accLower.includes('indonesia') || accLower.includes('jawa') || accLower.includes('sunda')
        ? 'Indonesian'
        : accent,
      description: description.trim() || `Instant Voice Clone (${accent})`,
      previewUrl,
      avatarUrl,
      avatarGradient,
      avatarEmoji,
      voiceIdEdge: baseVoiceId,
      pitchOffset,
      labels: {
        age: age as any,
        useCase: category === 'designed' ? 'Designed Voice' : 'Cloned Voice',
        tone: `${category === 'designed' ? 'Designed' : 'Cloned'} • ${accent}`,
        gender,
        ...labels,
      },
      clonedFromAudio: previewUrl,
      createdAt: new Date().toISOString(),
    };

    addCustomVoice(newVoice);

    return NextResponse.json({ success: true, voice: newVoice });
  } catch (error: any) {
    console.error('Clone error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
