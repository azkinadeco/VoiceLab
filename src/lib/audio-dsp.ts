'use client';

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  const numSamples = channelData.length;
  const dataLength = numSamples * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
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
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function decodeRealWaveformPeaks(
  audioUrl: string,
  barsCount = 56
): Promise<number[] | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const audioBuf = await ctx.decodeAudioData(arr);
    const raw = audioBuf.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(raw.length / barsCount));
    const peaks: number[] = [];

    let maxPeak = 0.01;
    for (let i = 0; i < barsCount; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize && start + j < raw.length; j++) {
        sum += Math.abs(raw[start + j]);
      }
      const avg = sum / blockSize;
      if (avg > maxPeak) maxPeak = avg;
      peaks.push(avg);
    }
    await ctx.close();

    return peaks.map((p) => Math.max(0.14, Math.min(0.96, p / maxPeak)));
  } catch {
    return null;
  }
}

export async function processVoiceIsolationDsp(
  inputBlob: Blob,
  noiseReductionStrength = 80
): Promise<{ wavBlob: Blob; base64: string; duration: number }> {
  const arr = await inputBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const tempCtx = new AudioCtx();
  const decoded = await tempCtx.decodeAudioData(arr);
  await tempCtx.close();

  const offlineCtx = new OfflineAudioContext(1, decoded.length, decoded.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;

  // 1. High-pass filter (remove low rumble & AC hum below 90-140Hz)
  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80 + (noiseReductionStrength / 100) * 65;
  highpass.Q.value = 0.85;

  // 2. Vocal Presence Peaking EQ (+4.5dB at 2.8kHz)
  const presence = offlineCtx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2800;
  presence.Q.value = 1.1;
  presence.gain.value = 4.5;

  // 3. Low-pass filter (remove high hiss above 7.2kHz)
  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 8200 - (noiseReductionStrength / 100) * 1400;
  lowpass.Q.value = 0.7;

  // 4. Dynamics Compressor
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;

  source.connect(highpass);
  highpass.connect(presence);
  presence.connect(lowpass);
  lowpass.connect(compressor);
  compressor.connect(offlineCtx.destination);

  source.start(0);
  const rendered = await offlineCtx.startRendering();

  // Apply soft noise gate on quiet frames
  const chan = rendered.getChannelData(0);
  const gateThreshold = 0.012 * (noiseReductionStrength / 100);
  for (let i = 0; i < chan.length; i++) {
    if (Math.abs(chan[i]) < gateThreshold) {
      chan[i] *= 0.15;
    }
  }

  const wavBlob = audioBufferToWavBlob(rendered);
  const base64 = await blobToBase64(wavBlob);
  return { wavBlob, base64, duration: Math.round(rendered.duration * 10) / 10 };
}

export async function analyzeVoiceSampleAcoustics(inputBlob: Blob): Promise<{
  durationSec: number;
  estimatedPitchHz: number;
  suggestedGender: 'male' | 'female';
  qualityLabel: string;
}> {
  const arr = await inputBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(arr);
  const data = decoded.getChannelData(0);
  const sr = decoded.sampleRate;

  // Estimate zero-crossing / fundamental frequency on voiced segments
  let zeroCrossings = 0;
  let activeSamples = 0;
  for (let i = 1; i < data.length; i++) {
    if (Math.abs(data[i]) > 0.025) {
      activeSamples++;
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
  }
  await ctx.close();

  const activeDuration = Math.max(0.5, activeSamples / sr);
  const rawZcrHz = zeroCrossings / (2 * activeDuration);
  // Map ZCR to typical human F0 range (95Hz - 245Hz)
  const estimatedPitchHz = Math.round(Math.max(95, Math.min(255, rawZcrHz / 5.5)));
  const suggestedGender = estimatedPitchHz > 165 ? 'female' : 'male';
  const durationSec = Math.round(decoded.duration * 10) / 10;
  const qualityLabel =
    durationSec >= 5 ? 'Optimal (Studio Ready)' : 'Pendek (Disarankan > 5 detik)';

  return {
    durationSec,
    estimatedPitchHz,
    suggestedGender,
    qualityLabel,
  };
}

/**
 * Extract audio track from any audio or video file (MP4, MOV, WebM, etc.)
 */
export async function extractAudioFromMediaBlob(
  fileOrBlob: Blob
): Promise<{ audioBuffer: AudioBuffer; wavBlob: Blob; duration: number }> {
  const arr = await fileOrBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const audioBuffer = await ctx.decodeAudioData(arr);
  await ctx.close();

  const wavBlob = audioBufferToWavBlob(audioBuffer);
  return {
    audioBuffer,
    wavBlob,
    duration: Math.round(audioBuffer.duration * 10) / 10,
  };
}

/**
 * Detect silence at start and end of audio and return optimal trim markers & trimmed WAV
 */
export async function detectSilenceAndTrim(
  inputBlob: Blob,
  thresholdDb = -42
): Promise<{
  trimmedBlob: Blob;
  startSec: number;
  endSec: number;
  originalDuration: number;
  newDuration: number;
}> {
  const arr = await inputBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(arr);
  await ctx.close();

  const raw = decoded.getChannelData(0);
  const sr = decoded.sampleRate;
  const thresholdLinear = Math.pow(10, thresholdDb / 20);

  // Scan for start
  let startSample = 0;
  const windowSize = 512;
  for (let i = 0; i < raw.length - windowSize; i += 256) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += raw[i + j] * raw[i + j];
    const rms = Math.sqrt(sum / windowSize);
    if (rms > thresholdLinear) {
      startSample = Math.max(0, i - Math.floor(sr * 0.05)); // 50ms pre-pad
      break;
    }
  }

  // Scan for end
  let endSample = raw.length - 1;
  for (let i = raw.length - 1 - windowSize; i > startSample; i -= 256) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += raw[i + j] * raw[i + j];
    const rms = Math.sqrt(sum / windowSize);
    if (rms > thresholdLinear) {
      endSample = Math.min(raw.length - 1, i + windowSize + Math.floor(sr * 0.05)); // 50ms post-pad
      break;
    }
  }

  const length = Math.max(1024, endSample - startSample);
  const offlineCtx = new OfflineAudioContext(1, length, sr);
  const newBuf = offlineCtx.createBuffer(1, length, sr);
  const newChan = newBuf.getChannelData(0);

  for (let i = 0; i < length; i++) {
    newChan[i] = raw[startSample + i] || 0;
  }

  const trimmedBlob = audioBufferToWavBlob(newBuf);
  const startSec = Math.round((startSample / sr) * 100) / 100;
  const endSec = Math.round((endSample / sr) * 100) / 100;

  return {
    trimmedBlob,
    startSec,
    endSec,
    originalDuration: Math.round(decoded.duration * 10) / 10,
    newDuration: Math.round((length / sr) * 10) / 10,
  };
}

/**
 * Slice audio buffer between startSec and endSec
 */
export async function sliceAudioBlob(
  inputBlob: Blob,
  startSec: number,
  endSec: number
): Promise<{ wavBlob: Blob; duration: number }> {
  const arr = await inputBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(arr);
  await ctx.close();

  const sr = decoded.sampleRate;
  const raw = decoded.getChannelData(0);
  const startSample = Math.max(0, Math.floor(startSec * sr));
  const endSample = Math.min(raw.length - 1, Math.floor(endSec * sr));
  const length = Math.max(1024, endSample - startSample);

  const offlineCtx = new OfflineAudioContext(1, length, sr);
  const newBuf = offlineCtx.createBuffer(1, length, sr);
  const newChan = newBuf.getChannelData(0);

  for (let i = 0; i < length; i++) {
    newChan[i] = raw[startSample + i] || 0;
  }

  const wavBlob = audioBufferToWavBlob(newBuf);
  return {
    wavBlob,
    duration: Math.round((length / sr) * 10) / 10,
  };
}
