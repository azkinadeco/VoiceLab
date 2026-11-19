import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/tts-engine';
import {
  getAllVoices,
  addGeneration,
  saveAudioFile,
  getAppSettings,
  applyPronunciationDictionary,
} from '@/lib/storage';
import { Generation, GenerationSettings } from '@/lib/types';

function generateSrtFromText(text: string, totalDurationSec: number): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return '';

  const totalChars = sentences.reduce((acc, s) => acc + s.length, 0) || 1;
  let currentSec = 0;

  const formatSrtTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
  };

  return sentences
    .map((sentence, idx) => {
      const share = (sentence.length / totalChars) * totalDurationSec;
      const start = currentSec;
      const end = Math.min(totalDurationSec, currentSec + Math.max(0.8, share));
      currentSec = end;
      return `${idx + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${sentence}\n`;
    })
    .join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId, settings, type = 'tts' } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text prompt is required' }, { status: 400 });
    }

    const voices = getAllVoices();
    const targetVoice = voices.find((v) => v.id === voiceId) || voices[0];

    const genSettings: GenerationSettings = {
      speed: settings?.speed ?? 1.0,
      pitch: settings?.pitch ?? 0,
      stability: settings?.stability ?? 75,
      similarity: settings?.similarity ?? 80,
      styleExaggeration: settings?.styleExaggeration ?? 0,
      speakerBoost: settings?.speakerBoost ?? true,
    };

    const appSettings = getAppSettings();
    const genId = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const filename = `${genId}.mp3`;

    // Apply pronunciation dictionary rules before synthesis
    const processedText = applyPronunciationDictionary(text.trim());

    // Synthesize voice
    const { buffer, duration } = await synthesizeSpeech(
      processedText,
      targetVoice.voiceIdEdge || 'en-US-ChristopherNeural',
      genSettings,
      appSettings
    );

    // Save audio file locally to PC storage
    const { relativeUrl } = await saveAudioFile(buffer, 'generations', filename);

    const srtSubtitle = generateSrtFromText(text.trim(), duration);

    // Create generation object
    const newGen: Generation = {
      id: genId,
      text: text.trim(),
      voiceId: targetVoice.id,
      voiceName: targetVoice.name,
      voiceAvatar: targetVoice.avatarUrl,
      audioUrl: relativeUrl,
      duration,
      createdAt: new Date().toISOString(),
      model: appSettings.ttsProvider === 'elevenlabs-api' ? 'Eleven Multilingual v2' : 'Neural Turbo v2.5 (Local)',
      type: type,
      fileSize: buffer.length,
      starred: false,
      settings: genSettings,
      srtSubtitle,
    };

    addGeneration(newGen);

    return NextResponse.json({ success: true, generation: newGen });
  } catch (error: any) {
    console.error('Speech generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate voice' },
      { status: 500 }
    );
  }
}
