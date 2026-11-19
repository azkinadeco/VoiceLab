import { NextRequest, NextResponse } from 'next/server';
import { saveAudioFile, addGeneration } from '@/lib/storage';
import { Generation } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioBase64, filename = 'recording.wav', duration = 5.0 } = body;

    if (!audioBase64) {
      return NextResponse.json({ error: 'Audio data is required' }, { status: 400 });
    }

    const isWav = audioBase64.startsWith('data:audio/wav');
    const cleanBase64 = audioBase64.replace(/^data:audio\/[\w+-]+;base64,/, '');
    const inputBuffer = Buffer.from(cleanBase64, 'base64');

    const genId = `isolated-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const ext = isWav ? 'wav' : 'mp3';
    const outputFilename = `${genId}.${ext}`;

    const { relativeUrl } = await saveAudioFile(inputBuffer, 'isolated', outputFilename);

    const newGen: Generation = {
      id: genId,
      text: `Voice Isolation DSP: ${filename}`,
      voiceId: 'voice-isolator',
      voiceName: 'Voice Isolator DSP',
      voiceAvatar:
        'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20120%20120%22%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2258%22%20fill%3D%22%2310b981%22%2F%3E%3Ctext%20x%3D%2260%22%20y%3D%2268%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fff%22%20font-family%3D%22sans-serif%22%20font-weight%3D%22700%22%20font-size%3D%2226%22%3EVI%3C%2Ftext%3E%3C%2Fsvg%3E',
      audioUrl: relativeUrl,
      duration: Number(duration) || 5.0,
      createdAt: new Date().toISOString(),
      model: 'Vocal Bandpass + Noise Gate DSP v2',
      type: 'isolated',
      fileSize: inputBuffer.length,
      starred: false,
      settings: {
        speed: 1,
        pitch: 0,
        stability: 100,
        similarity: 100,
        styleExaggeration: 0,
        speakerBoost: true,
      },
    };

    addGeneration(newGen);

    return NextResponse.json({ success: true, generation: newGen });
  } catch (error: any) {
    console.error('Isolation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
