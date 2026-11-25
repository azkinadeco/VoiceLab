import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech, mergeAudioBuffers } from '@/lib/tts-engine';
import {
  getAllVoices,
  addGeneration,
  saveAudioFile,
  getAppSettings,
  applyPronunciationDictionary,
} from '@/lib/storage';
import { Generation, StudioBlock } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { blocks, projectTitle = 'Multi-Speaker Studio Dialogue' } = body as {
      blocks: StudioBlock[];
      projectTitle?: string;
    };

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return NextResponse.json({ error: 'At least one dialogue block is required' }, { status: 400 });
    }

    const validBlocks = blocks.filter((b) => b.text && b.text.trim().length > 0);
    if (validBlocks.length === 0) {
      return NextResponse.json({ error: 'Dialogue blocks cannot be empty' }, { status: 400 });
    }

    const voices = getAllVoices();
    const appSettings = getAppSettings();
    const audioBuffers: Buffer[] = [];
    const updatedBlocks: StudioBlock[] = [];
    let totalDuration = 0;

    for (let i = 0; i < validBlocks.length; i++) {
      const block = validBlocks[i];
      const voice = voices.find((v) => v.id === block.voiceId) || voices[0];
      const processedText = applyPronunciationDictionary(block.text.trim());

      const { buffer, duration, format } = await synthesizeSpeech(
        processedText,
        voice.voiceIdEdge || 'en-US-ChristopherNeural',
        {
          speed: 1.0,
          pitch: 0,
          stability: 80,
          similarity: 85,
          styleExaggeration: 0,
          speakerBoost: true,
        },
        appSettings
      );

      const blockFile = `studio-line-${Date.now()}-${i}.${format}`;
      const savedBlock = await saveAudioFile(buffer, 'studio', blockFile);

      audioBuffers.push(buffer);
      totalDuration += duration + (block.pauseAfterMs || 300) / 1000;

      updatedBlocks.push({
        ...block,
        audioUrl: savedBlock.relativeUrl,
        duration,
      });
    }

    // Safely concatenate MP3 or WAV buffers into master studio file
    const { buffer: masterBuffer, format: masterFormat } = mergeAudioBuffers(audioBuffers);
    const masterId = `studio-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const masterFilename = `${masterId}.${masterFormat}`;
    const { relativeUrl } = await saveAudioFile(masterBuffer, 'studio', masterFilename);

    const scriptSummary = validBlocks
      .map((b) => `[${b.characterName}]: ${b.text.trim()}`)
      .join(' | ');

    const newGen: Generation = {
      id: masterId,
      text: `${projectTitle} — ${scriptSummary}`,
      voiceId: validBlocks[0].voiceId,
      voiceName: `${validBlocks.length} Speakers Studio`,
      voiceAvatar: voices.find((v) => v.id === validBlocks[0].voiceId)?.avatarUrl || voices[0].avatarUrl,
      audioUrl: relativeUrl,
      duration: Math.round(totalDuration * 10) / 10,
      createdAt: new Date().toISOString(),
      model: 'Studio Multi-Track Mastering v2',
      type: 'studio',
      fileSize: masterBuffer.length,
      starred: false,
      settings: {
        speed: 1.0,
        pitch: 0,
        stability: 85,
        similarity: 90,
        styleExaggeration: 0,
        speakerBoost: true,
      },
    };

    addGeneration(newGen);

    return NextResponse.json({
      success: true,
      generation: newGen,
      blocks: updatedBlocks,
    });
  } catch (error: any) {
    console.error('Studio multi-track error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
