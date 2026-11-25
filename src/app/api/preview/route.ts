import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/tts-engine';
import { getAllVoices, getAppSettings } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voiceId, customSampleText, provider, clientKeys } = body;

    const voices = getAllVoices();
    const voice = voices.find((v) => v.id === voiceId) || voices[0];

    let sampleText = customSampleText;
    if (!sampleText) {
      const accentLower = voice.accent.toLowerCase();
      if (accentLower.includes('jawa')) {
        sampleText = `Sugeng rawuh! Halo, saya ${voice.name.split(' ')[0]}, siap membacakan naskah Anda dengan aksen Jawa Nusantara yang santun dan jernih.`;
      } else if (accentLower.includes('sunda')) {
        sampleText = `Sampurasun! Halo, saya ${voice.name.split(' ')[0]}, siap menyuarakan konten kreatif Anda dengan logat Sunda Parahyangan yang hangat.`;
      } else if (accentLower.includes('indonesia')) {
        sampleText = `Halo! Ini adalah sampel suara neural ${voice.name.split(' ')[0]} dengan artikulasi Bahasa Indonesia yang natural dan berwibawa.`;
      } else if (accentLower.includes('british')) {
        sampleText = `Hello there! I am ${voice.name}, speaking with a crisp British RP accent for your narrations and documentaries.`;
      } else if (accentLower.includes('australian')) {
        sampleText = `G'day! I'm ${voice.name}, bringing a relaxed Australian cadence to your podcasts and stories.`;
      } else if (accentLower.includes('anime')) {
        sampleText = `おかえりなさい、司令官。今日も一緒に戦いましょうね！`;
      } else if (accentLower.includes('japanese')) {
        sampleText = `こんにちは！私は${voice.name}です。自然でクリアな日本語の音声をお届けします。`;
      } else if (accentLower.includes('korean')) {
        sampleText = `안녕하세요! 저는 보이스랩의 ${voice.name}입니다. 자연스러운 한국어 음성을 들어보세요.`;
      } else if (accentLower.includes('arabic')) {
        sampleText = `مرحباً بكم في مختبر الصوت، أنا ${voice.name} وأقدم لكم صوتاً عربياً واضحاً وطبيعياً.`;
      } else if (accentLower.includes('mandarin')) {
        sampleText = `你好！我是${voice.name}，很高兴为您提供自然流畅的中文语音合成。`;
      } else {
        sampleText = `Hello! This is ${voice.name}, a high-fidelity neural voice ready for your studio projects.`;
      }
    }

    const savedSettings = getAppSettings();
    const appSettings = {
      ...savedSettings,
      geminiApiKey: clientKeys?.geminiApiKey || savedSettings.geminiApiKey,
      freeTtsApiKey: clientKeys?.freeTtsApiKey || savedSettings.freeTtsApiKey,
      elevenLabsApiKey: clientKeys?.elevenLabsApiKey || savedSettings.elevenLabsApiKey,
      openAiApiKey: clientKeys?.openAiApiKey || savedSettings.openAiApiKey,
      ...(provider && ['edge-neural', 'voicevox', 'gemini-tts', 'freetts-api', 'elevenlabs-api', 'openai-api'].includes(provider)
        ? { ttsProvider: provider }
        : {}),
    };
    const { buffer } = await synthesizeSpeech(
      sampleText,
      voice.voiceIdEdge,
      {
        speed: voice.defaultSpeed || 1.0,
        pitch: voice.pitchOffset || 0,
        stability: 80,
        similarity: 85,
        styleExaggeration: 10,
        speakerBoost: true,
      },
      appSettings,
      {
        geminiVoice: voice.geminiVoice,
        voicevoxSpeakerId: voice.voicevoxSpeakerId,
        actingDirection: voice.actingDirection,
      }
    );

    const isWav = buffer.slice(0, 4).toString('ascii') === 'RIFF';
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': isWav ? 'audio/wav' : 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('Preview voice error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
