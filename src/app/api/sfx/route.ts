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

  const isExplosion = /explosion|boom|blast|thunder|impact|ledak|bom|petir|guntur|dentum/.test(p);
  const isLaser = /laser|blaster|pew|ray|tembak|sci-fi/.test(p);
  const isRain = /rain|water|ocean|wave|stream|hujan|air|ombak|sungai|laut|gerimis/.test(p);
  const isBell = /bell|chime|ding|notification|lonceng|bel|notifikasi|ting/.test(p);
  const isWhoosh = /whoosh|swoosh|transition|wind|angin|transisi|desir|wush|geser/.test(p);
  const isAlarm = /alarm|siren|sirine|warning|bahaya|beep/.test(p);
  const isApplause = /applause|clap|tepuk|sorak|crowd/.test(p);

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
    } else if (isAlarm) {
      // Dual-tone siren sweep
      const freq = 660 + 260 * Math.sin(2 * Math.PI * 2.5 * t);
      const gate = Math.sin(2 * Math.PI * 5 * t) > -0.2 ? 1 : 0.15;
      s = Math.sin(2 * Math.PI * freq * t) * 0.65 * gate;
    } else if (isApplause) {
      // Layered burst noise simulating crowd clapping
      const burst = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 7.3 * t) * Math.cos(2 * Math.PI * 11.7 * t), 2);
      const noise = Math.random() * 2 - 1;
      const env = Math.min(1, t * 3) * Math.min(1, (durationSec - t) * 2.5);
      s = noise * (0.35 + 0.65 * burst) * env * 0.75;
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
      voiceAvatar:
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#ec4899"/><text x="60" y="70" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700" font-size="30">SFX</text></svg>'
        ),
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
