import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { GenerationSettings, AppSettings } from './types';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
        // Hard split long sentence by words
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

// Tier 2 Fallback: Google Neural TTS MP3 over HTTPS (No API key needed, supports ID, JW, SU, EN-GB, EN-US, JA, KO, AR, etc.)
async function synthesizeGoogleNeuralFallback(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings
): Promise<{ buffer: Buffer; duration: number }> {
  const tl = mapEdgeVoiceToLangCode(voiceEdgeId);
  const chunks = splitTextIntoChunks(text, 170);
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const ttsspeed = settings.speed < 0.85 ? '0.24' : '1';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      chunk
    )}&tl=${encodeURIComponent(tl)}&total=1&idx=0&textlen=${chunk.length}&client=tw-ob&ttsspeed=${ttsspeed}`;

    const res = await fetch(url, {
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
  }

  const finalBuffer = Buffer.concat(buffers);
  if (finalBuffer.length < 256) {
    throw new Error('Google TTS returned empty audio buffer');
  }
  const wordCount = text.trim().split(/\s+/).length;
  const duration = Math.max(1.2, Math.round(((wordCount / 140) * 60 / settings.speed) * 10) / 10);
  return { buffer: finalBuffer, duration };
}

// Tier 3 Fallback: macOS Native Offline Speech Engine (/usr/bin/say + /usr/bin/afconvert)
function synthesizeMacNativeOffline(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings
): { buffer: Buffer; duration: number } {
  const tmpId = `voicelab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const aiffPath = path.join(os.tmpdir(), `${tmpId}.aiff`);
  const wavPath = path.join(os.tmpdir(), `${tmpId}.wav`);

  try {
    const lower = voiceEdgeId.toLowerCase();
    let macVoice = 'Damayanti'; // macOS built-in Indonesian voice
    if (lower.startsWith('en-gb')) macVoice = 'Daniel';
    else if (lower.startsWith('en-au')) macVoice = 'Karen';
    else if (lower.startsWith('en-')) macVoice = 'Samantha';
    else if (lower.startsWith('ja-')) macVoice = 'Kyoko';
    else if (lower.startsWith('ko-')) macVoice = 'Yuna';

    const wordsPerMin = Math.round(175 * Math.max(0.5, Math.min(1.8, settings.speed)));

    try {
      execFileSync('/usr/bin/say', ['-v', macVoice, '-r', String(wordsPerMin), '-o', aiffPath, text], {
        timeout: 15000,
      });
    } catch {
      // Fallback to default system voice if specific voice isn't installed
      execFileSync('/usr/bin/say', ['-r', String(wordsPerMin), '-o', aiffPath, text], {
        timeout: 15000,
      });
    }

    execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', aiffPath, wavPath], {
      timeout: 15000,
    });

    const wavBuffer = fs.readFileSync(wavPath);
    const wordCount = text.trim().split(/\s+/).length;
    const duration = Math.max(1.2, Math.round(((wordCount / 140) * 60 / settings.speed) * 10) / 10);
    return { buffer: wavBuffer, duration };
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
  settings: GenerationSettings
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  const format = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

  try {
    await tts.setMetadata(voiceEdgeId, format);
  } catch {
    await tts.setMetadata('id-ID-ArdiNeural', format);
  }

  // Speed + Stability modulation
  const stabilitySpeedOffset = ((50 - settings.stability) / 500) * 0.1;
  const effectiveSpeed = Math.max(0.5, Math.min(1.9, settings.speed + stabilitySpeedOffset));
  const ratePct = Math.round((effectiveSpeed - 1.0) * 100);
  const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;

  // Pitch + Style Exaggeration modulation (makes Style Exaggeration slider actually expressive!)
  const stylePitchBoost = Math.round((settings.styleExaggeration / 100) * 8);
  const pitchHz = Math.round(settings.pitch + stylePitchBoost);
  const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

  // Volume + Speaker Boost & Clarity Similarity modulation
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
    }, 20000);

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
}

export async function synthesizeSpeech(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings,
  appSettings: AppSettings
): Promise<{ buffer: Buffer; duration: number }> {
  const cleanText = text.trim();

  // Optional Tier 0: Official ElevenLabs API if configured by user
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
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const wordCount = cleanText.split(/\s+/).length;
        const duration = Math.max(1, (wordCount / 150) * 60 / settings.speed);
        return { buffer, duration };
      }
    } catch (e) {
      console.warn('ElevenLabs API failed, falling back to Neural Edge TTS:', e);
    }
  }

  // Tier 1: Microsoft Edge Neural TTS (with XML escaping & automatic retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const buffer = await runEdgeNeuralSingle(cleanText, voiceEdgeId, settings);
      const wordCount = cleanText.split(/\s+/).length;
      const duration = Math.max(1.2, Math.round(((wordCount / 140) * 60 / settings.speed) * 10) / 10);
      return { buffer, duration };
    } catch (edgeErr: any) {
      console.warn(`Edge Neural TTS attempt ${attempt} failed for ${voiceEdgeId}:`, edgeErr?.message || edgeErr);
      // If regional voice (e.g. jv-ID or su-ID) was rejected by Edge endpoint, retry once with id-ID-ArdiNeural / id-ID-GadisNeural
      if (attempt === 1 && (voiceEdgeId.startsWith('jv-') || voiceEdgeId.startsWith('su-'))) {
        voiceEdgeId = voiceEdgeId.toLowerCase().includes('siti') || voiceEdgeId.toLowerCase().includes('tuti')
          ? 'id-ID-GadisNeural'
          : 'id-ID-ArdiNeural';
      }
    }
  }

  // Tier 2: Google Translate Neural Speech API (Real human speech over HTTPS, zero sine-wave beep)
  try {
    console.log('Switching to Tier 2 Google Neural Speech Engine for:', voiceEdgeId);
    return await synthesizeGoogleNeuralFallback(cleanText, voiceEdgeId, settings);
  } catch (googleErr: any) {
    console.warn('Google Neural TTS fallback failed:', googleErr?.message || googleErr);
  }

  // Tier 3: macOS Native Offline Speech (/usr/bin/say)
  console.log('Switching to Tier 3 macOS Native Offline Speech Engine');
  return synthesizeMacNativeOffline(cleanText, voiceEdgeId, settings);
}
