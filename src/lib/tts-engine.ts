import { GenerationSettings, AppSettings } from './types';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SynthesisResult {
  buffer: Buffer;
  duration: number;
  format: 'mp3' | 'wav';
  engine: string;
}

function escapeXmlForSsml(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .trim();
}

function mapEdgeVoiceToLangCode(voiceEdgeId: string): string {
  const lower = voiceEdgeId.toLowerCase();
  if (lower.startsWith('id-')) return 'id';
  if (lower.startsWith('jv-')) return 'jw';
  if (lower.startsWith('su-')) return 'su';
  if (lower.startsWith('en-gb')) return 'en-GB';
  if (lower.startsWith('en-au')) return 'en-AU';
  if (lower.startsWith('en-')) return 'en-US';
  if (lower.startsWith('ja-')) return 'ja';
  if (lower.startsWith('ko-')) return 'ko';
  if (lower.startsWith('zh-')) return 'zh-CN';
  if (lower.startsWith('ar-')) return 'ar';
  if (lower.startsWith('es-')) return 'es';
  if (lower.startsWith('fr-')) return 'fr';
  if (lower.startsWith('de-')) return 'de';
  if (lower.startsWith('hi-')) return 'hi';
  return 'id';
}

function splitTextIntoChunks(text: string, maxLen = 175): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?।。，,;:])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        const words = s.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

function estimateDurationSec(text: string, speed: number): number {
  const wordCount = Math.max(1, text.trim().split(/\s+/).length);
  return Math.max(1.0, Math.round(((wordCount / 145) * 60 / Math.max(0.5, speed)) * 10) / 10);
}

function estimateWavDurationSec(wavBuffer: Buffer): number | null {
  if (wavBuffer.length < 44 || wavBuffer.slice(0, 4).toString('ascii') !== 'RIFF') return null;
  const byteRate = wavBuffer.readUInt32LE(28);
  const dataSize = wavBuffer.length - 44;
  if (byteRate <= 0 || dataSize <= 0) return null;
  return Math.max(0.5, Math.round((dataSize / byteRate) * 10) / 10);
}

// Tier 2 Fallback: Google Neural TTS MP3 over HTTPS
async function synthesizeGoogleNeuralFallback(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings
): Promise<SynthesisResult> {
  const tl = mapEdgeVoiceToLangCode(voiceEdgeId);
  const chunks = splitTextIntoChunks(text, 170);
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const ttsspeed = settings.speed < 0.85 ? '0.24' : '1';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      chunk
    )}&tl=${encodeURIComponent(tl)}&total=1&idx=0&textlen=${chunk.length}&client=tw-ob&ttsspeed=${ttsspeed}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      if (!res.ok) {
        throw new Error(`Google TTS HTTP ${res.status}`);
      }
      const arr = await res.arrayBuffer();
      buffers.push(Buffer.from(arr));
    } finally {
      clearTimeout(timer);
    }
  }

  const finalBuffer = Buffer.concat(buffers);
  if (finalBuffer.length < 256) {
    throw new Error('Google TTS returned empty audio buffer');
  }
  return {
    buffer: finalBuffer,
    duration: estimateDurationSec(text, settings.speed),
    format: 'mp3',
    engine: 'Google Neural TTS (Fallback)',
  };
}

let cachedMacVoices: Set<string> | null = null;
function getInstalledMacVoices(): Set<string> {
  if (cachedMacVoices) return cachedMacVoices;
  const set = new Set<string>();
  try {
    const out = execFileSync('/usr/bin/say', ['-v', '?'], { encoding: 'utf8', timeout: 5000 });
    for (const line of out.split('\n')) {
      const name = line.trim().split(/\s{2,}/)[0]?.trim();
      if (name) set.add(name);
    }
  } catch {}
  cachedMacVoices = set;
  return set;
}

// Tier 3 Fallback: macOS Native Offline Speech Engine (/usr/bin/say + /usr/bin/afconvert)
function synthesizeMacNativeOffline(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings
): SynthesisResult {
  const tmpId = `voicelab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const aiffPath = path.join(os.tmpdir(), `${tmpId}.aiff`);
  const wavPath = path.join(os.tmpdir(), `${tmpId}.wav`);

  try {
    const lower = voiceEdgeId.toLowerCase();
    const installed = getInstalledMacVoices();
    const candidates: string[] = [];
    if (lower.startsWith('en-gb')) candidates.push('Daniel', 'Serena', 'Samantha');
    else if (lower.startsWith('en-au')) candidates.push('Karen', 'Lee', 'Samantha');
    else if (lower.startsWith('en-')) candidates.push('Samantha', 'Alex', 'Daniel');
    else if (lower.startsWith('ja-')) candidates.push('Kyoko', 'Otoya');
    else if (lower.startsWith('ko-')) candidates.push('Yuna');
    else if (lower.startsWith('zh-')) candidates.push('Tingting', 'Sinji');
    else if (lower.startsWith('ar-')) candidates.push('Majed');
    else candidates.push('Damayanti', 'Samantha');

    const macVoice = candidates.find((c) => installed.has(c));
    const wordsPerMin = Math.round(175 * Math.max(0.5, Math.min(1.8, settings.speed)));

    const args = macVoice
      ? ['-v', macVoice, '-r', String(wordsPerMin), '-o', aiffPath, text]
      : ['-r', String(wordsPerMin), '-o', aiffPath, text];

    try {
      execFileSync('/usr/bin/say', args, { timeout: 25000 });
    } catch {
      execFileSync('/usr/bin/say', ['-r', String(wordsPerMin), '-o', aiffPath, text], {
        timeout: 25000,
      });
    }

    execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', aiffPath, wavPath], {
      timeout: 15000,
    });

    const wavBuffer = fs.readFileSync(wavPath);
    const duration = estimateWavDurationSec(wavBuffer) ?? estimateDurationSec(text, settings.speed);
    return {
      buffer: wavBuffer,
      duration,
      format: 'wav',
      engine: 'macOS Offline Speech (Local)',
    };
  } finally {
    try {
      if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
      if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    } catch {}
  }
}

async function runEdgeNeuralSingle(
  cleanText: string,
  voiceEdgeId: string,
  settings: GenerationSettings,
  isServerless = false
): Promise<Buffer> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const connTimeout = isServerless ? 3500 : 8000;
  const synthTimeout = isServerless ? 6000 : 22000;
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: connTimeout,
    synthesisTimeoutMs: synthTimeout,
  });
  const format = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

  try {
    try {
      await tts.setMetadata(voiceEdgeId, format);
    } catch {
      await tts.setMetadata('id-ID-ArdiNeural', format);
    }

    const stabilitySpeedOffset = ((50 - settings.stability) / 500) * 0.1;
    const effectiveSpeed = Math.max(0.5, Math.min(1.9, settings.speed + stabilitySpeedOffset));
    const ratePct = Math.round((effectiveSpeed - 1.0) * 100);
    const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;

    const stylePitchBoost = Math.round((settings.styleExaggeration / 100) * 8);
    const pitchHz = Math.round(settings.pitch + stylePitchBoost);
    const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

    const boostVol = settings.speakerBoost ? 10 : 0;
    const clarityVol = Math.round(((settings.similarity - 50) / 50) * 8);
    const totalVol = Math.max(-20, Math.min(30, boostVol + clarityVol));
    const volumeStr = totalVol >= 0 ? `+${totalVol}%` : `${totalVol}%`;

    const escapedSsmlText = escapeXmlForSsml(cleanText);

    const streamResult = tts.toStream(escapedSsmlText, {
      pitch: pitchStr,
      rate: rateStr,
      volume: volumeStr,
    });
    const audioStream = (streamResult as any).audioStream || streamResult;

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Edge TTS stream timeout'));
      }, synthTimeout);

      audioStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      audioStream.on('end', () => {
        clearTimeout(timer);
        resolve();
      });
      audioStream.on('error', (err: any) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const buf = Buffer.concat(chunks);
    if (buf.length < 200) {
      throw new Error('Edge TTS returned empty audio stream');
    }
    return buf;
  } finally {
    try {
      tts.close();
    } catch {}
  }
}

/**
 * Safely merge multiple audio buffers (handles both MP3 frames and RIFF WAV files).
 */
export function mergeAudioBuffers(buffers: Buffer[]): { buffer: Buffer; format: 'mp3' | 'wav' } {
  if (buffers.length === 0) {
    return { buffer: Buffer.alloc(0), format: 'mp3' };
  }
  const allWav = buffers.every((b) => b.length > 44 && b.slice(0, 4).toString('ascii') === 'RIFF');
  if (allWav) {
    const header = Buffer.from(buffers[0].slice(0, 44));
    const pcmParts = buffers.map((b) => b.slice(44));
    const totalData = pcmParts.reduce((sum, p) => sum + p.length, 0);
    header.writeUInt32LE(36 + totalData, 4);
    header.writeUInt32LE(totalData, 40);
    return { buffer: Buffer.concat([header, ...pcmParts]), format: 'wav' };
  }
  return { buffer: Buffer.concat(buffers), format: 'mp3' };
}

function wrapPcmAsWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function mapEdgeVoiceToGeminiVoice(voiceEdgeId: string): string {
  const lower = (voiceEdgeId || '').toLowerCase();
  if (lower.includes('gadis')) return 'Kore';
  if (lower.includes('ardi')) return 'Charon';
  if (lower.includes('siti')) return 'Aoede';
  if (lower.includes('dimas')) return 'Orus';
  if (lower.includes('tuti')) return 'Zephyr';
  if (lower.includes('jajang')) return 'Puck';
  if (lower.includes('jenny') || lower.includes('aria') || lower.includes('emma') || lower.includes('sonia') || lower.includes('nanami') || lower.includes('sunhi') || lower.includes('zariyah') || lower.includes('xiaoxiao') || lower.includes('denise') || lower.includes('swara')) {
    return 'Kore';
  }
  return 'Puck';
}

// Gemini 2.5 Flash Preview TTS via Google AI Studio REST API (pure HTTPS, 24kHz PCM -> WAV)
async function synthesizeGeminiTts(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings,
  apiKey: string
): Promise<SynthesisResult> {
  const voiceName = mapEdgeVoiceToGeminiVoice(voiceEdgeId);
  let promptText = text;
  if (settings.styleExaggeration >= 45) {
    promptText = `Say enthusiastically and expressively: ${text}`;
  } else if (settings.speed >= 1.2) {
    promptText = `Say at a brisk, energetic pace: ${text}`;
  } else if (settings.speed <= 0.88) {
    promptText = `Say calmly and softly: ${text}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini TTS HTTP ${res.status}: ${errText.slice(0, 160)}`);
    }

    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
    const b64 = part?.inlineData?.data;
    const mime: string = part?.inlineData?.mimeType || '';
    if (!b64) {
      throw new Error('Gemini TTS tidak mengembalikan data audio');
    }

    const rawBuf = Buffer.from(b64, 'base64');
    if (rawBuf.length < 256) {
      throw new Error('Gemini TTS mengembalikan audio kosong');
    }

    // Parse sample rate from mimeType e.g. "audio/L16;codec=pcm;rate=24000"
    const rateMatch = mime.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const isAlreadyWav = rawBuf.slice(0, 4).toString('ascii') === 'RIFF';
    const wavBuffer = isAlreadyWav ? rawBuf : wrapPcmAsWav(rawBuf, sampleRate, 1, 16);
    const duration = estimateWavDurationSec(wavBuffer) ?? estimateDurationSec(text, settings.speed);

    return {
      buffer: wavBuffer,
      duration,
      format: 'wav',
      engine: `Gemini 2.5 Flash TTS (${voiceName})`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Tier 0C / Vercel Primary: FreeTTS Neural REST API (https://freetts.org/developers)
// Supports all 2,250+ neural voices (id-ID-ArdiNeural, id-ID-GadisNeural, jv-ID-*, su-ID-*, etc.) over pure HTTPS
async function synthesizeFreeTts(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings,
  apiKey: string
): Promise<SynthesisResult> {
  const stabilitySpeedOffset = ((50 - settings.stability) / 500) * 0.1;
  const effectiveSpeed = Math.max(0.5, Math.min(1.9, settings.speed + stabilitySpeedOffset));
  const ratePct = Math.round((effectiveSpeed - 1.0) * 100);
  const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;

  const stylePitchBoost = Math.round((settings.styleExaggeration / 100) * 8);
  const pitchHz = Math.round(settings.pitch + stylePitchBoost);
  const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch('https://freetts.org/api/v1/tts', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        voice: voiceEdgeId || 'id-ID-GadisNeural',
        rate: rateStr,
        pitch: pitchStr,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`FreeTTS HTTP ${res.status}: ${errText.slice(0, 140)}`);
    }

    const data = await res.json();
    const fileId = data?.file_id;
    if (!fileId) {
      throw new Error('FreeTTS tidak mengembalikan file_id');
    }

    const audioRes = await fetch(`https://freetts.org/api/audio/${encodeURIComponent(fileId)}`, {
      signal: controller.signal,
    });
    if (!audioRes.ok) {
      throw new Error(`FreeTTS audio download HTTP ${audioRes.status}`);
    }
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    if (buffer.length < 256) {
      throw new Error('FreeTTS mengembalikan audio kosong');
    }

    return {
      buffer,
      duration: estimateDurationSec(text, settings.speed),
      format: 'mp3',
      engine: 'FreeTTS Neural API (2,250+ Voices)',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function synthesizeSpeech(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings,
  appSettings: AppSettings
): Promise<SynthesisResult> {
  const cleanText = text.trim();

  // Optional Tier 0A: Official ElevenLabs API
  if (appSettings.ttsProvider === 'elevenlabs-api' && appSettings.elevenLabsApiKey) {
    try {
      const elevenVoiceId = '21m00Tcm4TlvDq8ikWAM';
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': appSettings.elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: settings.stability / 100,
            similarity_boost: settings.similarity / 100,
            style: settings.styleExaggeration / 100,
            use_speaker_boost: settings.speakerBoost,
          },
        }),
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
          buffer,
          duration: estimateDurationSec(cleanText, settings.speed),
          format: 'mp3',
          engine: 'ElevenLabs Multilingual v2',
        };
      }
    } catch (e) {
      console.warn('ElevenLabs API failed, falling back to Neural Edge TTS:', e);
    }
  }

  // Optional Tier 0B: OpenAI TTS API
  if (appSettings.ttsProvider === 'openai-api' && appSettings.openAiApiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${appSettings.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'alloy',
          input: cleanText,
          speed: Math.max(0.25, Math.min(4.0, settings.speed)),
        }),
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
          buffer,
          duration: estimateDurationSec(cleanText, settings.speed),
          format: 'mp3',
          engine: 'OpenAI TTS-1',
        };
      }
    } catch (e) {
      console.warn('OpenAI TTS API failed, falling back to Neural Edge TTS:', e);
    }
  }

  const geminiKey = (appSettings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  const freeTtsKey = (appSettings.freeTtsApiKey || process.env.FREETTS_API_KEY || '').trim();
  const preferred = appSettings.ttsProvider;

  // Build ordered cloud provider chain based on user's chosen provider (with automatic fallback if rate-limited!)
  const tryGemini = async () => {
    if (!geminiKey) return null;
    try {
      return await synthesizeGeminiTts(cleanText, voiceEdgeId, settings, geminiKey);
    } catch (e: any) {
      console.warn('Gemini TTS failed, falling back:', e?.message || e);
      return null;
    }
  };

  const tryFreeTts = async () => {
    if (!freeTtsKey) return null;
    try {
      return await synthesizeFreeTts(cleanText, voiceEdgeId, settings, freeTtsKey);
    } catch (e: any) {
      console.warn('FreeTTS API failed, falling back:', e?.message || e);
      return null;
    }
  };

  if (preferred === 'gemini-tts') {
    const r1 = await tryGemini();
    if (r1) return r1;
    const r2 = await tryFreeTts();
    if (r2) return r2;
  } else if (preferred === 'freetts-api') {
    const r1 = await tryFreeTts();
    if (r1) return r1;
    const r2 = await tryGemini();
    if (r2) return r2;
  } else {
    // Auto / edge-neural: prefer Gemini if key is set, else FreeTTS if key is set
    if (geminiKey) {
      const r1 = await tryGemini();
      if (r1) return r1;
    }
    if (freeTtsKey) {
      const r2 = await tryFreeTts();
      if (r2) return r2;
    }
  }

  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
  );

  // On Vercel/serverless, use pure-HTTPS Google Neural TTS first (fast ~0.3s, zero WebSocket crashes)
  if (isServerless) {
    try {
      return await synthesizeGoogleNeuralFallback(cleanText, voiceEdgeId, settings);
    } catch (googleErr: any) {
      console.warn('Google Neural TTS (Vercel primary) failed:', googleErr?.message || googleErr);
    }
    try {
      const buffer = await runEdgeNeuralSingle(cleanText, voiceEdgeId, settings, true);
      return {
        buffer,
        duration: estimateDurationSec(cleanText, settings.speed),
        format: 'mp3',
        engine: 'Neural Turbo v2.5 (Cloud)',
      };
    } catch (edgeErr: any) {
      console.warn('Edge Neural TTS (Vercel fallback) failed:', edgeErr?.message || edgeErr);
      throw new Error('Semua engine TTS online gagal merespons. Silakan coba lagi beberapa saat.');
    }
  }

  // On local PC: Tier 1 = Microsoft Edge Neural TTS (28 distinct neural voices)
  let targetEdgeId = voiceEdgeId;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const buffer = await runEdgeNeuralSingle(cleanText, targetEdgeId, settings, false);
      return {
        buffer,
        duration: estimateDurationSec(cleanText, settings.speed),
        format: 'mp3',
        engine: 'Neural Turbo v2.5 (Local)',
      };
    } catch (edgeErr: any) {
      console.warn(`Edge Neural TTS attempt ${attempt} failed for ${targetEdgeId}:`, edgeErr?.message || edgeErr);
      if (attempt === 1 && (targetEdgeId.startsWith('jv-') || targetEdgeId.startsWith('su-'))) {
        targetEdgeId =
          targetEdgeId.toLowerCase().includes('siti') || targetEdgeId.toLowerCase().includes('tuti')
            ? 'id-ID-GadisNeural'
            : 'id-ID-ArdiNeural';
      }
    }
  }

  // Tier 2: Google Translate Neural Speech API
  try {
    console.log('Switching to Tier 2 Google Neural Speech Engine for:', voiceEdgeId);
    return await synthesizeGoogleNeuralFallback(cleanText, voiceEdgeId, settings);
  } catch (googleErr: any) {
    console.warn('Google Neural TTS fallback failed:', googleErr?.message || googleErr);
  }

  // Tier 3: macOS Native Offline Speech (/usr/bin/say) — only available on macOS
  if (process.platform === 'darwin') {
    console.log('Switching to Tier 3 macOS Native Offline Speech Engine');
    return synthesizeMacNativeOffline(cleanText, voiceEdgeId, settings);
  }
  throw new Error('Semua engine TTS online gagal merespons. Silakan coba lagi beberapa saat.');
}
