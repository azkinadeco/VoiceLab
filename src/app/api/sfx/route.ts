import { NextRequest, NextResponse } from 'next/server';
import { saveAudioFile, addGeneration } from '@/lib/storage';
import { Generation } from '@/lib/types';

function createWavHeader(dataLength: number, sampleRate = 44100, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

function synthesizeSoundEffect(prompt: string, durationSec = 3.0): Buffer {
  const sampleRate = 44100;
  const totalSamples = Math.floor(sampleRate * Math.max(1, Math.min(10, durationSec)));
  const p = prompt.toLowerCase();

  const samples = new Float32Array(totalSamples);

  const isExplosion = p.includes('explosion') || p.includes('boom') || p.includes('blast') || p.includes('thunder') || p.includes('impact');
  const isLaser = p.includes('laser') || p.includes('blaster') || p.includes('pew') || p.includes('ray');
  const isRain = p.includes('rain') || p.includes('water') || p.includes('ocean') || p.includes('wave') || p.includes('stream');
  const isBell = p.includes('bell') || p.includes('chime') || p.includes('ding') || p.includes('notification');
  const isWhoosh = p.includes('whoosh') || p.includes('swoosh') || p.includes('transition') || p.includes('wind');

  let lastNoise = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durationSec;
    let s = 0;

    if (isExplosion) {
      // White noise with exponential decay + sub bass pitch drop
      const noise = (Math.random() * 2 - 1);
      lastNoise = lastNoise * 0.94 + noise * 0.06;
      const decay = Math.exp(-t * 2.5);
      const subFreq = Math.max(30, 120 - t * 80);
      const sub = Math.sin(2 * Math.PI * subFreq * t);
      s = (lastNoise * 1.5 + sub * 0.8) * decay;
    } else if (isLaser) {
      // Frequency sweep from high to low
      const freq = Math.max(120, 2800 * Math.exp(-t * 12));
      const decay = Math.exp(-t * 6);
      s = Math.sin(2 * Math.PI * freq * t) * decay;
    } else if (isRain) {
      // Modulated pink noise
      const noise = Math.random() * 2 - 1;
      lastNoise = lastNoise * 0.90 + noise * 0.10;
      const modulation = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.3 * t);
      s = lastNoise * modulation * 0.8;
    } else if (isBell) {
      // Multi-harmonic chime
      const decay = Math.exp(-t * 1.8);
      s = (
        Math.sin(2 * Math.PI * 880 * t) * 0.5 +
        Math.sin(2 * Math.PI * 1760 * t) * 0.3 +
        Math.sin(2 * Math.PI * 2640 * t) * 0.15 +
        Math.sin(2 * Math.PI * 528 * t) * 0.2
      ) * decay;
    } else if (isWhoosh) {
      // Swept resonant bandpass noise
      const envelope = Math.sin(Math.PI * progress);
      const noise = Math.random() * 2 - 1;
      const centerFreq = 400 + 1200 * Math.sin(Math.PI * progress);
      const tone = Math.sin(2 * Math.PI * centerFreq * t);
      s = (noise * 0.7 + tone * 0.3) * Math.pow(envelope, 2);
    } else {
      // Futuristic synth ambient drop
      const baseFreq = 220;
      const vibrato = 1 + 0.05 * Math.sin(2 * Math.PI * 5 * t);
      const decay = Math.exp(-t * 1.2);
      s = (Math.sin(2 * Math.PI * baseFreq * vibrato * t) + 0.5 * Math.sin(2 * Math.PI * baseFreq * 2 * t)) * decay;
    }

    // Soft clipper to prevent harsh distortion
    samples[i] = Math.max(-1, Math.min(1, s * 0.9));
  }

  // Convert float samples to 16-bit PCM buffer
  const pcmBuffer = Buffer.alloc(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    const val = Math.max(-32768, Math.min(32767, Math.floor(samples[i] * 32767)));
    pcmBuffer.writeInt16LE(val, i * 2);
  }

  const header = createWavHeader(pcmBuffer.length, sampleRate, 1, 16);
  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, duration = 3.0 } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const wavBuffer = synthesizeSoundEffect(prompt.trim(), parseFloat(duration) || 3.0);
    const genId = `sfx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const filename = `${genId}.wav`;

    const { relativeUrl } = await saveAudioFile(wavBuffer, 'sfx', filename);

    const newGen: Generation = {
      id: genId,
      text: prompt.trim(),
      voiceId: 'sfx-generator',
      voiceName: 'Sound FX Engine',
      voiceAvatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80',
      audioUrl: relativeUrl,
      duration: parseFloat(duration) || 3.0,
      createdAt: new Date().toISOString(),
      model: 'Eleven SFX Neural v1 (Local)',
      type: 'sfx',
      fileSize: wavBuffer.length,
      starred: false,
      settings: {
        speed: 1,
        pitch: 0,
        stability: 100,
        similarity: 100,
        styleExaggeration: 0,
        speakerBoost: false,
      },
    };

    addGeneration(newGen);

    return NextResponse.json({ success: true, generation: newGen });
  } catch (error: any) {
    console.error('SFX generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
