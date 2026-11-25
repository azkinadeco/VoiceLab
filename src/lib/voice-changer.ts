'use client';

/**
 * Real, fully-local voice changer DSP (runs in the browser, no network).
 * - Granular overlap-add pitch shifter + time-stretcher (keeps duration independent of pitch)
 * - Effect chain rendered with OfflineAudioContext (filters, ring-mod, echo, reverb, distortion)
 */

export interface VoiceChangerSettings {
  pitch: number; // semitones, -12..+12
  tempo: number; // 0.5..2.0 (1 = original speed)
  robot: number; // 0..100 ring-mod amount
  echo: number; // 0..100
  reverb: number; // 0..100
  telephone: boolean; // band-limit 300-3400Hz + light drive
  distortion: number; // 0..100
  brightness: number; // -12..+12 dB high-shelf
}

export const DEFAULT_VC: VoiceChangerSettings = {
  pitch: 0,
  tempo: 1,
  robot: 0,
  echo: 0,
  reverb: 0,
  telephone: false,
  distortion: 0,
  brightness: 0,
};

export interface VoicePreset {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  settings: Partial<VoiceChangerSettings>;
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: 'normal', label: 'Asli', emoji: '🎙️', desc: 'Tanpa efek', settings: {} },
  { id: 'female', label: 'Jadi Wanita', emoji: '👩', desc: 'Pria → wanita', settings: { pitch: 5, brightness: 3 } },
  { id: 'male', label: 'Jadi Pria', emoji: '🧔', desc: 'Wanita → pria', settings: { pitch: -5, brightness: -2 } },
  { id: 'kid', label: 'Anak Kecil', emoji: '🧒', desc: 'Suara bocil', settings: { pitch: 8, brightness: 4, tempo: 1.05 } },
  { id: 'chipmunk', label: 'Chipmunk', emoji: '🐿️', desc: 'Lucu & cepat', settings: { pitch: 12, tempo: 1.15 } },
  { id: 'deep', label: 'Bass Berat', emoji: '🎚️', desc: 'Suara dalam', settings: { pitch: -8, brightness: -3 } },
  { id: 'monster', label: 'Monster', emoji: '👹', desc: 'Seram & berat', settings: { pitch: -11, distortion: 35, reverb: 25, tempo: 0.92 } },
  { id: 'robot', label: 'Robot', emoji: '🤖', desc: 'Metalik', settings: { robot: 85, echo: 10 } },
  { id: 'alien', label: 'Alien', emoji: '👽', desc: 'Luar angkasa', settings: { pitch: 4, robot: 45, echo: 30 } },
  { id: 'phone', label: 'Telepon', emoji: '📞', desc: 'Suara HP / radio', settings: { telephone: true, distortion: 15 } },
  { id: 'cave', label: 'Gua / Echo', emoji: '⛰️', desc: 'Bergema', settings: { echo: 70, reverb: 40 } },
  { id: 'stage', label: 'Panggung', emoji: '🎤', desc: 'Reverb hall', settings: { reverb: 65, brightness: 2 } },
];

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  return float32ToWav(channelData, sampleRate, numChannels);
}

export function float32ToWav(channelData: Float32Array, sampleRate: number, numChannels = 1): Blob {
  const numSamples = channelData.length;
  const dataLength = numSamples * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/** Decode any audio/video blob the browser understands into a mono Float32 signal. */
export async function decodeToMono(blob: Blob): Promise<{ data: Float32Array; sampleRate: number; duration: number }> {
  const arr = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arr);
    const len = decoded.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += ch[i] / decoded.numberOfChannels;
    }
    return { data: mono, sampleRate: decoded.sampleRate, duration: decoded.duration };
  } finally {
    ctx.close().catch(() => {});
  }
}

/** Resample mono audio to a target sample rate (used for 16 kHz Whisper input). */
export async function resampleMono(data: Float32Array, fromRate: number, toRate: number): Promise<Float32Array> {
  if (fromRate === toRate) return data;
  const length = Math.max(1, Math.ceil((data.length * toRate) / fromRate));
  const offline = new OfflineAudioContext(1, length, toRate);
  const buf = offline.createBuffer(1, data.length, fromRate);
  buf.getChannelData(0).set(data);
  const src = offline.createBufferSource();
  src.buffer = buf;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Granular overlap-add pitch shift + time stretch.
 * Output sample at position o (within grain) reads input at (grainStart*tempo + i*ratio).
 */
export function pitchTimeShift(input: Float32Array, sampleRate: number, semitones: number, tempo: number): Float32Array {
  const ratio = Math.pow(2, semitones / 12);
  if (Math.abs(semitones) < 0.01 && Math.abs(tempo - 1) < 0.001) return input.slice();

  const grain = Math.round(sampleRate * 0.046); // ~46ms grains
  const hop = Math.round(grain / 4);
  const outLen = Math.floor(input.length / tempo);
  const out = new Float32Array(outLen + grain);
  const norm = new Float32Array(outLen + grain);
  const win = new Float32Array(grain);
  for (let i = 0; i < grain; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grain - 1));

  for (let o = 0; o < outLen; o += hop) {
    // Center the read window so pitched grains stay aligned with the timeline
    const inCenter = o * tempo;
    const readStart = inCenter - (grain * ratio - grain) / 2;
    for (let i = 0; i < grain; i++) {
      const pos = readStart + i * ratio;
      if (pos < 0 || pos >= input.length - 1) continue;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s = input[i0] * (1 - frac) + input[i0 + 1] * frac;
      out[o + i] += s * win[i];
      norm[o + i] += win[i];
    }
  }
  const result = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) result[i] = norm[i] > 0.05 ? out[i] / norm[i] : out[i];
  return result;
}

function makeDistortionCurve(amount: number): Float32Array {
  const k = amount * 4;
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const imp = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = imp.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return imp;
}

/** Full voice-changer render. Returns a WAV blob + duration. */
export async function renderVoiceChange(
  blob: Blob,
  s: VoiceChangerSettings
): Promise<{ wavBlob: Blob; duration: number }> {
  const { data, sampleRate } = await decodeToMono(blob);
  const shifted = pitchTimeShift(data, sampleRate, s.pitch, s.tempo);

  const tail = s.echo > 0 || s.reverb > 0 ? Math.floor(sampleRate * 1.6) : 0;
  const offline = new OfflineAudioContext(1, shifted.length + tail, sampleRate);
  const buf = offline.createBuffer(1, shifted.length, sampleRate);
  buf.getChannelData(0).set(shifted);
  const src = offline.createBufferSource();
  src.buffer = buf;

  let node: AudioNode = src;

  // Clean up DC / rumble
  const hp = offline.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = s.telephone ? 320 : 60;
  node.connect(hp);
  node = hp;

  if (s.telephone) {
    const lp = offline.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    lp.Q.value = 0.9;
    node.connect(lp);
    node = lp;
  }

  if (s.brightness !== 0) {
    const shelf = offline.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 3000;
    shelf.gain.value = s.brightness;
    node.connect(shelf);
    node = shelf;
  }

  if (s.distortion > 0) {
    const ws = offline.createWaveShaper();
    ws.curve = makeDistortionCurve(s.distortion) as any;
    ws.oversample = '4x';
    node.connect(ws);
    node = ws;
  }

  if (s.robot > 0) {
    // Ring modulation: multiply signal by a carrier oscillator
    const amt = s.robot / 100;
    const ringGain = offline.createGain();
    ringGain.gain.value = 0;
    const osc = offline.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 30 + amt * 40;
    const oscDepth = offline.createGain();
    oscDepth.gain.value = 1;
    osc.connect(oscDepth);
    oscDepth.connect(ringGain.gain);
    osc.start(0);

    const dry = offline.createGain();
    dry.gain.value = 1 - amt;
    const wet = offline.createGain();
    wet.gain.value = amt * 1.4;
    const merge = offline.createGain();
    node.connect(dry);
    node.connect(ringGain);
    ringGain.connect(wet);
    dry.connect(merge);
    wet.connect(merge);

    // Short metallic comb
    const comb = offline.createDelay(0.05);
    comb.delayTime.value = 0.008;
    const combFb = offline.createGain();
    combFb.gain.value = 0.35 * amt;
    merge.connect(comb);
    comb.connect(combFb);
    combFb.connect(comb);
    const combOut = offline.createGain();
    merge.connect(combOut);
    comb.connect(combOut);
    node = combOut;
  }

  const master = offline.createGain();
  master.gain.value = 1;
  node.connect(master);

  if (s.echo > 0) {
    const amt = s.echo / 100;
    const delay = offline.createDelay(1.5);
    delay.delayTime.value = 0.18 + amt * 0.22;
    const fb = offline.createGain();
    fb.gain.value = 0.25 + amt * 0.4;
    const wet = offline.createGain();
    wet.gain.value = 0.35 + amt * 0.3;
    node.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(master);
  }

  if (s.reverb > 0) {
    const amt = s.reverb / 100;
    const conv = offline.createConvolver();
    conv.buffer = makeImpulse(offline, 1.2 + amt * 1.8, 2.5);
    const wet = offline.createGain();
    wet.gain.value = amt * 0.6;
    node.connect(conv);
    conv.connect(wet);
    wet.connect(master);
  }

  const comp = offline.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  master.connect(comp);
  comp.connect(offline.destination);

  src.start(0);
  const rendered = await offline.startRendering();

  // Peak normalize to -1 dBFS
  const out = rendered.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.0001) {
    const g = 0.89 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }

  return { wavBlob: float32ToWav(out, sampleRate), duration: Math.round(rendered.duration * 10) / 10 };
}

/** Encode Float32 PCM as base64 (for sending 16 kHz audio to local Whisper). */
export function float32ToBase64(data: Float32Array): string {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/** Decode → 16 kHz mono → send to local Whisper endpoint. */
export async function transcribeBlobLocally(blob: Blob, language: string): Promise<string> {
  const { data, sampleRate } = await decodeToMono(blob);
  const pcm16k = await resampleMono(data, sampleRate, 16000);
  const maxSamples = 16000 * 120; // 2 minutes cap
  const clipped = pcm16k.length > maxSamples ? pcm16k.slice(0, maxSamples) : pcm16k;
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pcmBase64: float32ToBase64(clipped), language }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Transkripsi gagal');
  return String(json.text || '').trim();
}
