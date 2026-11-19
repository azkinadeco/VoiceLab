import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/tts-engine';
import {
  getAllVoices,
  getDubbings,
  saveDubbing,
  addGeneration,
  saveAudioFile,
  getAppSettings,
} from '@/lib/storage';
import { DubbingProject, Generation } from '@/lib/types';

function mapTargetLangToCode(targetLang: string): string {
  const lower = targetLang.toLowerCase();
  if (lower.includes('indonesia')) return 'id';
  if (lower.includes('english')) return 'en';
  if (lower.includes('japanese')) return 'ja';
  if (lower.includes('korean')) return 'ko';
  if (lower.includes('spanish')) return 'es';
  if (lower.includes('french')) return 'fr';
  if (lower.includes('german')) return 'de';
  if (lower.includes('arabic')) return 'ar';
  if (lower.includes('chinese') || lower.includes('mandarin')) return 'zh-CN';
  if (lower.includes('hindi')) return 'hi';
  return 'en';
}

async function autoTranslateText(text: string, targetLang: string): Promise<string> {
  const clean = text.trim();
  const tl = mapTargetLangToCode(targetLang);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      tl
    )}&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && Array.isArray(json[0])) {
        const translated = json[0].map((part: any) => part?.[0] || '').join('');
        if (translated.trim().length > 0) {
          return translated.trim();
        }
      }
    }
  } catch (e) {
    console.warn('Auto-translate fallback triggered:', e);
  }

  return clean;
}

function buildSrt(text: string, durationSec: number): string {
  const parts = text
    .split(/(?<=[.!?।。])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';

  const totalChars = parts.reduce((a, b) => a + b.length, 0) || 1;
  let cursor = 0;

  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    const p = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`;
  };

  return parts
    .map((line, i) => {
      const segDur = Math.max(1.0, (line.length / totalChars) * durationSec);
      const start = cursor;
      const end = Math.min(durationSec, cursor + segDur);
      cursor = end;
      return `${i + 1}\n${fmt(start)} --> ${fmt(end)}\n${line}\n`;
    })
    .join('\n');
}

export async function GET() {
  try {
    const dubbings = getDubbings();
    return NextResponse.json({ dubbings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Standalone quick translation endpoint for UI button
    if (body.action === 'translate_only') {
      const translated = await autoTranslateText(body.sourceText || '', body.targetLanguage || 'English (US)');
      return NextResponse.json({ success: true, translatedText: translated });
    }

    const {
      title = 'Localization Project',
      sourceLanguage = 'Indonesian',
      targetLanguage = 'English (US)',
      sourceText,
      translatedText,
      voiceId,
    } = body;

    if (!sourceText || !sourceText.trim()) {
      return NextResponse.json({ error: 'Source script text is required' }, { status: 400 });
    }

    const finalTranslated =
      translatedText && translatedText.trim().length > 0 && translatedText.trim() !== sourceText.trim()
        ? translatedText.trim()
        : await autoTranslateText(sourceText, targetLanguage);

    const voices = getAllVoices();
    const targetVoice =
      voices.find((v) => v.id === voiceId) ||
      voices.find((v) =>
        v.language.toLowerCase().includes(targetLanguage.toLowerCase().split(' ')[0])
      ) ||
      voices[0];

    const appSettings = getAppSettings();
    const dubId = `dub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const filename = `${dubId}.mp3`;

    const { buffer, duration } = await synthesizeSpeech(
      finalTranslated,
      targetVoice.voiceIdEdge,
      {
        speed: 1.0,
        pitch: 0,
        stability: 80,
        similarity: 85,
        styleExaggeration: 10,
        speakerBoost: true,
      },
      appSettings
    );

    const { relativeUrl } = await saveAudioFile(buffer, 'dubbing', filename);
    const srtContent = buildSrt(finalTranslated, duration);

    const dubProject: DubbingProject = {
      id: dubId,
      title,
      sourceLanguage,
      targetLanguage,
      sourceText: sourceText.trim(),
      translatedText: finalTranslated,
      voiceId: targetVoice.id,
      audioUrl: relativeUrl,
      srtContent,
      duration,
      createdAt: new Date().toISOString(),
    };

    saveDubbing(dubProject);

    const newGen: Generation = {
      id: dubId,
      text: `[Dubbing ${sourceLanguage} → ${targetLanguage}] ${finalTranslated}`,
      voiceId: targetVoice.id,
      voiceName: `${targetVoice.name} (Dub)`,
      voiceAvatar: targetVoice.avatarUrl,
      audioUrl: relativeUrl,
      duration,
      createdAt: dubProject.createdAt,
      model: 'Eleven Dubbing & SRT Engine v2',
      type: 'dubbing',
      fileSize: buffer.length,
      starred: false,
      settings: {
        speed: 1.0,
        pitch: 0,
        stability: 80,
        similarity: 85,
        styleExaggeration: 10,
        speakerBoost: true,
      },
      srtSubtitle: srtContent,
    };

    addGeneration(newGen);

    return NextResponse.json({
      success: true,
      dubbing: dubProject,
      generation: newGen,
    });
  } catch (error: any) {
    console.error('Dubbing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
