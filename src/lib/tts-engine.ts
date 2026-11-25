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
  fallbackNotice?: string;
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
      const fallbackEdge = voiceEdgeId.toLowerCase().startsWith('ja-')
        ? 'ja-JP-NanamiNeural'
        : 'id-ID-ArdiNeural';
      await tts.setMetadata(fallbackEdge, format);
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

const EMOTION_DIRECTIONS: Record<string, { cue: string; speedMul: number; pitchAdd: number }> = {
  gentle: {
    cue: 'Speak in Japanese with a very gentle, warm, soft, soothing anime female voice',
    speedMul: 0.94,
    pitchAdd: 1,
  },
  cheerful: {
    cue: 'Speak in Japanese with a bright, super cheerful, bubbly genki anime girl voice',
    speedMul: 1.08,
    pitchAdd: 5,
  },
  sad: {
    cue: 'Speak in Japanese with a fragile, tearful, slow, melancholic anime girl voice',
    speedMul: 0.85,
    pitchAdd: -3,
  },
  rough: {
    cue: 'Speak in Japanese with a sharp, feisty, slightly rough tsundere anime girl voice',
    speedMul: 1.05,
    pitchAdd: 2,
  },
  angry: {
    cue: 'Speak in Japanese with a fierce, angry, intense, shouting anime warrior girl voice',
    speedMul: 1.12,
    pitchAdd: 3,
  },
  mature: {
    cue: 'Speak in Japanese with a deep, mature, poised, regal anime onee-san empress voice',
    speedMul: 0.92,
    pitchAdd: -6,
  },
  seductive: {
    cue: 'Speak in Japanese with a sultry, teasing, breathy, playful ara-ara seductive anime woman voice',
    speedMul: 0.88,
    pitchAdd: -4,
  },
  cold: {
    cue: 'Speak in Japanese with a cool, quiet, emotionless, mysterious kuudere anime girl voice',
    speedMul: 0.9,
    pitchAdd: -3,
  },
  battle: {
    cue: 'Speak in Japanese like an anime RPG heroine passionately shouting a special attack skill in battle',
    speedMul: 1.14,
    pitchAdd: 4,
  },
};

export interface VoiceSynthesisHints {
  geminiVoice?: string;
  elevenVoiceId?: string;
  voicevoxSpeakerId?: number;
  actingDirection?: string;
  accent?: string;
}

function mapEdgeVoiceToElevenVoice(voiceEdgeId: string): string {
  const lower = (voiceEdgeId || '').toLowerCase();
  if (lower.includes('aoi')) return 'jBpfuIE2acCO8z3wKNLl'; // Gigi (Anime)
  if (lower.includes('mayu')) return 'cgSgspJ2msm6clMCkdW9'; // Jessica (Expressive)
  if (lower.includes('nanami')) return 'EXAVITQu4vr4xnSDxMaL'; // Sarah (Soft)
  if (lower.includes('shiori')) return 'XrExE9yKIg1WjnnlVkGX'; // Matilda (Mature)
  if (lower.includes('gadis') || lower.includes('jenny') || lower.includes('aria')) return '21m00Tcm4TlvDq8ikWAM'; // Rachel
  if (lower.includes('siti') || lower.includes('tuti')) return 'FGY2WhTYpPnrIDTdsKH5'; // Laura
  if (lower.includes('dimas') || lower.includes('ryan')) return 'JBFqnCBsd6RMkjVDRZzb'; // George
  if (lower.includes('jajang') || lower.includes('guy')) return 'TX3LPaxmHKxFdv7VOQHJ'; // Liam
  return 'nPczCjzI2devNBz1zQrb'; // Brian
}

// Clean Romaji -> natural Japanese (Kanji + Katakana + Hiragana) converter.
// STRICT RULE: ONLY place Japanese commas (、) where the user actually wrote a comma (,) or stutter (-)!
// NEVER insert fake commas in the middle of clauses (like したり / あんたのために / 寝てる間に / すごいすごい).
function romajiToAnimeJapanese(input: string): string {
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(input)) {
    return input
      .replace(/([\u3040-\u30FF\u4E00-\u9FAF])\s+([\u3040-\u30FF\u4E00-\u9FAF])/g, '$1$2')
      .replace(/~/g, 'ー')
      .trim();
  }

  let s = input
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[`'’]/g, "'")
    // CRITICAL: Normalize macron vowels FIRST because JS \b word-boundary fails on non-ASCII chars like ē/ō/ū!
    .replace(/ā/g, 'aa')
    .replace(/ī/g, 'ii')
    .replace(/ū/g, 'uu')
    .replace(/ē/g, 'ee')
    .replace(/ō/g, 'ou')
    // 1. Anime stutters ("be-betsu" -> "べっ、別", "a-ano" -> "あっ、あの")
    .replace(/\bbe-betsu\b/g, 'べっ、別')
    .replace(/\b([a-z]{1,2})-([a-z]+)/g, '$1っ、$2')
    // 2. High-frequency anime & game vocabulary -> exact Kanji/Katakana (ZERO fake commas!)
    .replace(/\bkon'?nichiwa\b/g, 'こんにちは')
    .replace(/\bkonbanwa\b/g, 'こんばんは')
    .replace(/\bohayou\s+gozaimasu\b/g, 'おはようございます')
    .replace(/\bohayou\b/g, 'おはよう')
    .replace(/\barigatou\s+gozaimasu\b/g, 'ありがとうございます')
    .replace(/\barigatou\b/g, 'ありがとう')
    .replace(/\byoroshiku\b/g, 'よろしく')
    .replace(/\bokaerinasai\b/g, 'おかえりなさい')
    .replace(/\bokaeri\b/g, 'おかえり')
    .replace(/\bsaikin\b/g, '最近')
    .replace(/\bie\s+de\b/g, '家で')
    .replace(/\bgeemu\b/g, 'ゲーム')
    .replace(/\bshitari\b/g, 'したり')
    .replace(/\banime\b/g, 'アニメ')
    .replace(/\bmitari\b/g, '見たり')
    .replace(/\bmiru\s+no\b/g, '見るの')
    .replace(/\bmiru\b/g, '見る')
    .replace(/\bsuru\s+dake\s+nanda\b/g, 'するだけなんだ')
    .replace(/\bhee+\b/g, 'へぇー')
    .replace(/\bkimi\s+mo\b/g, '君も')
    .replace(/\bkimi\b/g, '君')
    .replace(/\bbetsu\s+ni\b/g, '別に')
    .replace(/\banta\s+no\s+tame\s+ni\b/g, 'あんたのために')
    .replace(/\banta\b/g, 'あんた')
    .replace(/\btakarabako\b/g, '宝箱')
    .replace(/\batsumete\s+oita\b/g, '集めておいた')
    .replace(/\bn\s*janai\s*n\s*dakara\s*ne\b/g, 'んじゃないんだからね')
    .replace(/\bjanai\b/g, 'じゃない')
    .replace(/\bdakara\s+ne\b/g, 'だからね')
    .replace(/\bwaa+i\b/g, 'わーい')
    .replace(/\bneteru\s+aida\s+ni\b/g, '寝てる間に')
    .replace(/\bneteru\b/g, '寝てる')
    .replace(/\baida\s+ni\b/g, '間に')
    .replace(/\breberu\b/g, 'レベル')
    .replace(/\bagatteru\s*~?/g, '上がってるー')
    .replace(/\bsugoi\s+sugoi\b/g, 'すごいすごい')
    .replace(/\bsugoi\b/g, 'すごい')
    .replace(/\bboisu\s+rabu\b/g, 'ボイスラボ')
    .replace(/\byoukoso\b/g, 'ようこそ')
    .replace(/\bonsei\b/g, '音声')
    .replace(/\bakusento\b/g, 'アクセント')
    .replace(/\bsentaku\s+shi\b/g, '選択し')
    .replace(/\bseisei\b/g, '生成')
    .replace(/\bkurikku\s+shite\b/g, 'クリックして')
    .replace(/\bnyuuraru\b/g, 'ニューラル')
    .replace(/\bningen\s+no\s+youna\b/g, '人間のような')
    .replace(/\bshizen'?na\b/g, '自然な')
    .replace(/\bkiite\s+mite\s+kudasai\b/g, '聞いてみてください')
    .replace(/~/g, 'ー')
    .replace(/\s+wa(?=\s|[.,!?]|$)/g, ' は')
    .replace(/\s+e(?=\s|[.,!?]|$)/g, ' へ')
    .replace(/\s+o(?=\s|[.,!?]|$)/g, ' を')
    .replace(/\s+wo(?=\s|[.,!?]|$)/g, ' を');

  const table: Record<string, string> = {
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
    sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
    cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
    nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
    mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
    gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
    pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
    jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
    shi: 'し', chi: 'ち', tsu: 'つ',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    sa: 'さ', si: 'し', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', ti: 'ち', tu: 'つ', te: 'て', to: 'と',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
    va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
    fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
    la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    '.': '。', ',': '、', '!': '！', '?': '？',
  };

  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(ch)) {
      out += ch;
      i++;
      continue;
    }
    if (ch === "'" || ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (
      i + 1 < s.length &&
      ch === s[i + 1] &&
      /[bcdfghjklmpqrstvwxyz]/.test(ch)
    ) {
      out += 'っ';
      i++;
      continue;
    }
    const tri = s.slice(i, i + 3);
    if (table[tri]) {
      out += table[tri];
      i += 3;
      continue;
    }
    const bi = s.slice(i, i + 2);
    if (table[bi]) {
      out += table[bi];
      i += 2;
      continue;
    }
    if (ch === 'n') {
      const next = s[i + 1] || '';
      if (!next || !/[aiueoy]/.test(next)) {
        out += 'ん';
        i++;
        continue;
      }
    }
    if (table[ch]) {
      out += table[ch];
      i++;
      continue;
    }
    if (/[0-9ー〜！？。、っ\n]/.test(ch)) {
      out += ch;
    }
    i++;
  }
  return out.replace(/、+/g, '、').replace(/。+/g, '。').trim() || input;
}

// Convert any remaining pure-Hiragana clause into natural Kanji+Kana while preserving commas & guarding against IME traps
async function upgradeSentenceToKanjiSafe(sentence: string): Promise<string> {
  const parts = sentence.split(/([、。！？]+)/);
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^[、。！？]+$/.test(part) || /[\u4E00-\u9FAF\u30A0-\u30FF]/.test(part) || part.length <= 4) {
      out.push(part);
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const url = `https://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(part)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        out.push(part);
        continue;
      }
      const data: unknown = await res.json();
      if (!Array.isArray(data)) {
        out.push(part);
        continue;
      }
      let converted = data
        .map((seg: any) => (Array.isArray(seg) && Array.isArray(seg[1]) && seg[1][0] ? String(seg[1][0]) : ''))
        .join('')
        .trim();
      if (!converted) {
        out.push(part);
        continue;
      }
      converted = converted
        .replace(/和愛/g, 'わーい')
        .replace(/上ってる/g, '上がってる')
        .replace(/入ラル/g, 'ニューラル')
        .replace(/選択肢/g, '選択し')
        .replace(/アニメミル/g, 'アニメ見る');
      out.push(converted);
    } catch {
      out.push(part);
    } finally {
      clearTimeout(timer);
    }
  }
  return out.join('');
}

type DialogueMood = 'casual' | 'curious' | 'tsundere' | 'happy' | 'sad';

interface DirectedVoicevoxSegment {
  jp: string;
  mood: DialogueMood;
  pauseMs: number;
}

function detectSentenceMood(sentence: string): DialogueMood {
  if (/べっ|別に|あんた|だからね|ふん|バカ|ばか/.test(sentence)) return 'tsundere';
  if (/わぁい|わーい|すごい|やった|上がってる|うれし|最高/.test(sentence)) return 'happy';
  if (/[？?]$/.test(sentence)) return 'curious';
  if (/お願い|一人にしないで|悲し|泣/.test(sentence)) return 'sad';
  if (/[！!]$/.test(sentence)) return 'happy';
  return 'casual';
}

// Per-speaker acoustic profile so mature/seductive voices sound warm, low, soft & alluring (never shrill/high-pitched!)
// and tsundere/normal voices speak at a natural, unhurried conversational pace like Gemini TTS.
function getSpeakerAcousticProfile(speakerId: number): {
  baseSpeed: number;
  basePitch: number;
  baseIntonation: number;
  commaPauseSec: number;
} {
  // Reina (Dewasa) -> Speaker #29 (No.7) or #17 / #20: lower pitch to warm adult female alto (-0.045), unhurried poised pace (0.87)
  if ([29, 17, 20, 9].includes(speakerId)) {
    return { baseSpeed: 0.87, basePitch: -0.042, baseIntonation: 1.32, commaPauseSec: 0.30 };
  }
  // Lilith (Menggoda) -> Speaker #4 (Metan Sexy) or #5: lower pitch (-0.035) + slower breathy tempo (0.85) so it sounds soft & seductive, NOT shrill
  if ([4, 5].includes(speakerId)) {
    return { baseSpeed: 0.85, basePitch: -0.035, baseIntonation: 1.36, commaPauseSec: 0.32 };
  }
  // Rei (Sedih / Dingin) -> Speaker #36 / #14: soft, gentle, slow (0.86)
  if ([36, 14, 22].includes(speakerId)) {
    return { baseSpeed: 0.86, basePitch: -0.015, baseIntonation: 1.22, commaPauseSec: 0.32 };
  }
  // Yui (Lembut) -> Speaker #0 / #10: warm, gentle healer (0.88)
  if ([0, 10].includes(speakerId)) {
    return { baseSpeed: 0.88, basePitch: -0.01, baseIntonation: 1.30, commaPauseSec: 0.28 };
  }
  // Akane (Tsundere) -> Speaker #2 / #6: clear, expressive, NEVER rushed (0.90 base speed, distinct comma pauses!)
  if ([2, 6].includes(speakerId)) {
    return { baseSpeed: 0.90, basePitch: 0.0, baseIntonation: 1.38, commaPauseSec: 0.28 };
  }
  // Default (Momo #1/#3, Hina #8, etc.): natural conversational anime pace (0.91)
  return { baseSpeed: 0.91, basePitch: 0.0, baseIntonation: 1.35, commaPauseSec: 0.27 };
}

// Keep each full sentence as ONE single request (smooth coarticulation) with real Gemini-like inter-sentence pauses (650-780ms)
async function buildExpressiveSegments(text: string): Promise<DirectedVoicevoxSegment[]> {
  const jpFull = romajiToAnimeJapanese(text);
  const rawSentences = jpFull
    .split(/(?<=[。！？.!?\n]+)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: DirectedVoicevoxSegment[] = [];

  for (let sIdx = 0; sIdx < rawSentences.length; sIdx++) {
    const rawSent = rawSentences[sIdx];
    const isLastSent = sIdx === rawSentences.length - 1;
    const sent = await upgradeSentenceToKanjiSafe(rawSent);
    const mood = detectSentenceMood(sent);

    let pauseMs = 0;
    if (!isLastSent) {
      if (/[…]{1,}|\.{3,}/.test(sent)) pauseMs = 780;
      else if (sent.length <= 6 && /[！!]$/.test(sent)) pauseMs = 340; // clear pause after "わーい！" before next sentence
      else if (/[？?]$/.test(sent)) pauseMs = 720; // natural pause after question like Gemini
      else if (/[！!]$/.test(sent)) pauseMs = 680; // natural pause after exclamation
      else pauseMs = 700; // clear period breathing pause between sentences
    }

    segments.push({
      jp: sent,
      mood,
      pauseMs,
    });
  }

  return segments.length > 0 ? segments : [{ jp: jpFull, mood: 'casual', pauseMs: 0 }];
}

function createWavSilence(durationMs: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const numSamples = Math.max(0, Math.round((sampleRate * durationMs) / 1000));
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const pcm = Buffer.alloc(dataSize, 0);
  return wrapPcmAsWav(pcm, sampleRate, numChannels, bitsPerSample);
}

// Local VOICEVOX Engine (http://127.0.0.1:50021) — Gemini-matched prosody, clear comma & period pauses, warm adult formant pitch
async function synthesizeVoicevox(
  text: string,
  speakerId: number,
  settings: GenerationSettings,
  baseUrl: string,
  _geminiKey?: string
): Promise<SynthesisResult> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const segments = await buildExpressiveSegments(text);
  const profile = getSpeakerAcousticProfile(speakerId);
  const wavBuffers: Buffer[] = [];
  let detectedSampleRate = 24000;

  for (const seg of segments) {
    const sentence = seg.jp;
    const isQuestion = /[？?]$/.test(sentence);
    const isExclaim = /[！!]$/.test(sentence);
    const isHappy = seg.mood === 'happy';
    const isTsundere = seg.mood === 'tsundere';
    const isSad = seg.mood === 'sad';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const queryRes = await fetch(
        `${cleanUrl}/audio_query?text=${encodeURIComponent(sentence)}&speaker=${encodeURIComponent(String(speakerId))}`,
        { method: 'POST', signal: controller.signal }
      );
      if (!queryRes.ok) {
        throw new Error(`VOICEVOX audio_query HTTP ${queryRes.status}`);
      }
      const audioQuery = await queryRes.json();

      // Unhurried, expressive conversational pacing tuned to match Gemini TTS
      audioQuery.speedScale = isSad
        ? Number((profile.baseSpeed * 0.94).toFixed(3))
        : isQuestion
          ? Number((profile.baseSpeed * 0.96).toFixed(3))
          : isTsundere
            ? Number((profile.baseSpeed * 0.98).toFixed(3))
            : isHappy
              ? Number((profile.baseSpeed * 1.02).toFixed(3))
              : profile.baseSpeed;
      audioQuery.pitchScale = profile.basePitch;
      audioQuery.intonationScale = isHappy
        ? Math.min(1.55, profile.baseIntonation + 0.12)
        : isTsundere
          ? Math.min(1.50, profile.baseIntonation + 0.08)
          : isQuestion
            ? Math.min(1.45, profile.baseIntonation + 0.05)
            : profile.baseIntonation;
      audioQuery.volumeScale = isHappy || isExclaim ? 1.04 : 1.0;
      audioQuery.prePhonemeLength = 0.10;
      audioQuery.postPhonemeLength = 0.10;
      audioQuery.pauseLengthScale = 1.0;

      if (Array.isArray(audioQuery.accent_phrases) && audioQuery.accent_phrases.length > 0) {
        const phrases = audioQuery.accent_phrases;
        const count = phrases.length;

        for (let p = 0; p < count; p++) {
          const phrase = phrases[p];
          const moras = Array.isArray(phrase.moras) ? phrase.moras : [];

          // 1. Only pause at REAL user commas (pause_mora): 140ms for stutter "べっ、", 240ms for normal comma "最近、" / "へぇー、"
          if (phrase.pause_mora && typeof phrase.pause_mora.vowel_length === 'number') {
            const isStutter = moras.length <= 2 && moras[moras.length - 1]?.text === 'っ';
            phrase.pause_mora.vowel_length = isStutter ? 0.14 : 0.24;
          }
        }

        // 2. Questions (?) ONLY get native interrogative inflection; NEVER lift final mora pitch on (!) because that turns "すごい！" into a question "すごい？"
        const lastPhrase = phrases[count - 1];
        if (isQuestion && lastPhrase) {
          lastPhrase.is_interrogative = true;
        } else if (isExclaim && phrases[0]?.moras?.length > 0) {
          // On exclamations (!), boost the OPENING accented moras (e.g. "わー" in "わーい！", "すご" in "すごい！") so it sounds excited, NOT questioning!
          const firstMoras = phrases[0].moras;
          for (let m = 0; m < Math.min(2, firstMoras.length); m++) {
            if (typeof firstMoras[m].pitch === 'number' && firstMoras[m].pitch > 0) {
              firstMoras[m].pitch = Number((firstMoras[m].pitch * 1.05).toFixed(4));
            }
          }
        }
      }

      const synthRes = await fetch(
        `${cleanUrl}/synthesis?speaker=${encodeURIComponent(String(speakerId))}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
          body: JSON.stringify(audioQuery),
        }
      );
      if (!synthRes.ok) {
        throw new Error(`VOICEVOX synthesis HTTP ${synthRes.status}`);
      }
      const wavPart = Buffer.from(await synthRes.arrayBuffer());
      if (wavPart.length > 44) {
        if (wavPart.slice(0, 4).toString('ascii') === 'RIFF') {
          detectedSampleRate = wavPart.readUInt32LE(24) || 24000;
        }
        wavBuffers.push(wavPart);
        if (seg.pauseMs > 0) {
          wavBuffers.push(createWavSilence(seg.pauseMs, detectedSampleRate));
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (wavBuffers.length === 0) {
    throw new Error('VOICEVOX mengembalikan audio kosong');
  }
  const merged = mergeAudioBuffers(wavBuffers);
  const duration = estimateWavDurationSec(merged.buffer) ?? estimateDurationSec(text, settings.speed);
  return {
    buffer: merged.buffer,
    duration,
    format: 'wav',
    engine: `VOICEVOX Lokal (Speaker #${speakerId})`,
  };
}

// Gemini 2.5 Flash Preview TTS via Google AI Studio REST API (pure HTTPS, 24kHz PCM -> WAV)
async function synthesizeGeminiTts(
  text: string,
  voiceEdgeId: string,
  settings: GenerationSettings,
  apiKey: string,
  hints?: VoiceSynthesisHints
): Promise<SynthesisResult> {
  const voiceName = hints?.geminiVoice || mapEdgeVoiceToGeminiVoice(voiceEdgeId);
  const emo = settings.emotionStyle ? EMOTION_DIRECTIONS[settings.emotionStyle] : undefined;
  let promptText = text;
  if (emo) {
    promptText = `${emo.cue}: ${text}`;
  } else if (hints?.actingDirection) {
    promptText = `${hints.actingDirection}: ${text}`;
  } else if (settings.styleExaggeration >= 45) {
    promptText = `Say enthusiastically and expressively: ${text}`;
  } else if (settings.speed >= 1.2) {
    promptText = `Say at a brisk, energetic pace: ${text}`;
  } else if (settings.speed <= 0.88) {
    promptText = `Say calmly and softly: ${text}`;
  }

  const modelsToTry = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
  let lastErr: Error | null = null;

  for (const modelName of modelsToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
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
        lastErr = new Error(`Gemini ${modelName} HTTP ${res.status}: ${errText.slice(0, 140)}`);
        continue;
      }

      const data = await res.json();
      const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
      const b64 = part?.inlineData?.data;
      const mime: string = part?.inlineData?.mimeType || '';
      if (!b64) {
        lastErr = new Error(`Gemini ${modelName} tidak mengembalikan data audio`);
        continue;
      }

      const rawBuf = Buffer.from(b64, 'base64');
      if (rawBuf.length < 256) {
        lastErr = new Error(`Gemini ${modelName} mengembalikan audio kosong`);
        continue;
      }

      const rateMatch = mime.match(/rate=(\d+)/i);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const isAlreadyWav = rawBuf.slice(0, 4).toString('ascii') === 'RIFF';
      const wavBuffer = isAlreadyWav ? rawBuf : wrapPcmAsWav(rawBuf, sampleRate, 1, 16);
      const duration = estimateWavDurationSec(wavBuffer) ?? estimateDurationSec(text, settings.speed);

      return {
        buffer: wavBuffer,
        duration,
        format: 'wav',
        engine: `${modelName.includes('pro') ? 'Gemini 2.5 Pro TTS' : 'Gemini 2.5 Flash TTS'} (${voiceName})`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('Gemini TTS gagal');
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
  appSettings: AppSettings,
  hints?: VoiceSynthesisHints
): Promise<SynthesisResult> {
  const cleanText = text.trim();
  const emo = settings.emotionStyle ? EMOTION_DIRECTIONS[settings.emotionStyle] : undefined;
  const tunedSettings: GenerationSettings = emo
    ? {
        ...settings,
        speed: Math.max(0.6, Math.min(1.8, settings.speed * emo.speedMul)),
        pitch: Math.max(-35, Math.min(50, settings.pitch + emo.pitchAdd)),
      }
    : {
        ...settings,
        pitch: Math.max(-35, Math.min(50, settings.pitch)),
      };

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
  const elevenKey = (appSettings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || '').trim();
  const voicevoxUrl = (appSettings.voicevoxUrl || process.env.VOICEVOX_URL || 'http://127.0.0.1:50021').trim();
  const preferred = appSettings.ttsProvider;

  let fallbackNotice: string | undefined;

  // If user explicitly chose VOICEVOX, call local VOICEVOX engine first (and surface clear error if offline)
  if (preferred === 'voicevox') {
    const speakerId =
      typeof settings.voicevoxSpeakerId === 'number'
        ? settings.voicevoxSpeakerId
        : typeof hints?.voicevoxSpeakerId === 'number'
          ? hints.voicevoxSpeakerId
          : 0;
    try {
      return await synthesizeVoicevox(cleanText, speakerId, settings, voicevoxUrl, geminiKey);
    } catch (vvErr: any) {
      const msg = String(vvErr?.message || vvErr);
      console.warn('VOICEVOX local engine error:', msg);
      if (vvErr?.name === 'AbortError' || msg.includes('aborted')) {
        throw new Error(
          'VOICEVOX butuh waktu terlalu lama memuat model suara ini (timeout). Coba klik Generate sekali lagi atau gunakan teks lebih pendek.'
        );
      }
      if (msg.includes('VOICEVOX audio_query HTTP') || msg.includes('VOICEVOX synthesis HTTP')) {
        throw new Error(`VOICEVOX gagal memproses suara (${msg}). Coba pilih karakter/speaker lain.`);
      }
      throw new Error(
        `VOICEVOX Engine belum aktif di ${voicevoxUrl}. Double-click VoiceLab.command di Desktop untuk menyalakannya otomatis.`
      );
    }
  }

  const isLocalEnv = !Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
  );
  const isJapaneseVoice =
    hints?.accent === 'Anime JP' ||
    typeof hints?.voicevoxSpeakerId === 'number' ||
    voiceEdgeId.toLowerCase().startsWith('ja-');

  // For Japanese voices on Edge Neural / FreeTTS / ElevenLabs, convert Romaji -> natural Kanji+Katakana first
  const getNormalizedTextForNeural = async (): Promise<string> => {
    if (!isJapaneseVoice) return cleanText;
    try {
      const segs = await buildExpressiveSegments(cleanText);
      return segs.map((s) => s.jp).join(' ');
    } catch {
      return romajiToAnimeJapanese(cleanText);
    }
  };

  // ElevenLabs Multilingual v2 Synthesis (supports distinct character voices + Japanese/Indonesian/English)
  const tryElevenLabs = async () => {
    if (!elevenKey) {
      if (preferred === 'elevenlabs-api') {
        fallbackNotice = 'API key ElevenLabs belum diisi — otomatis pindah ke cadangan.';
      }
      return null;
    }
    try {
      const elevenVoiceId = hints?.elevenVoiceId || mapEdgeVoiceToElevenVoice(voiceEdgeId);
      const neuralText = await getNormalizedTextForNeural();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenKey,
          },
          body: JSON.stringify({
            text: neuralText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: Math.max(0.25, Math.min(0.95, settings.stability / 100)),
              similarity_boost: Math.max(0.4, Math.min(0.95, settings.similarity / 100)),
              style: Math.max(0, Math.min(0.85, settings.styleExaggeration / 100)),
              use_speaker_boost: settings.speakerBoost,
            },
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`ElevenLabs HTTP ${res.status}: ${errBody.slice(0, 120)}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 256) throw new Error('ElevenLabs mengembalikan audio kosong');
        return {
          buffer,
          duration: estimateDurationSec(cleanText, settings.speed),
          format: 'mp3' as const,
          engine: 'ElevenLabs Multilingual v2',
          ...(fallbackNotice ? { fallbackNotice } : {}),
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.warn('ElevenLabs API failed, falling back:', msg);
      fallbackNotice =
        msg.includes('429') || msg.includes('quota')
          ? 'Kuota ElevenLabs sedang limit (429) — otomatis pindah ke cadangan.'
          : 'ElevenLabs gagal merespons — otomatis pindah ke cadangan.';
      return null;
    }
  };

  // Build ordered cloud provider chain based on user's chosen provider (with transparent fallback notices!)
  const tryGemini = async () => {
    if (!geminiKey) {
      if (preferred === 'gemini-tts') {
        fallbackNotice = 'API key Gemini belum diisi — otomatis pindah ke cadangan.';
      }
      return null;
    }
    try {
      const res = await synthesizeGeminiTts(cleanText, voiceEdgeId, tunedSettings, geminiKey, hints);
      return fallbackNotice ? { ...res, fallbackNotice } : res;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.warn('Gemini TTS failed, falling back:', msg);
      fallbackNotice = msg.includes('429')
        ? 'Kuota gratis Gemini sedang limit (429) — otomatis pindah ke cadangan.'
        : 'Gemini gagal merespons — otomatis pindah ke cadangan.';
      return null;
    }
  };

  // On local Mac, Microsoft Edge Neural TTS uses the EXACT same voices as FreeTTS (ja-JP-MayuNeural / NanamiNeural / ShioriNeural)
  // but with ZERO 4.5s English watermark and ZERO daily quota limit!
  const tryLocalEdgeNeural = async () => {
    if (!isLocalEnv) return null;
    try {
      const neuralText = await getNormalizedTextForNeural();
      const buffer = await runEdgeNeuralSingle(neuralText, voiceEdgeId, tunedSettings, false);
      return {
        buffer,
        duration: estimateDurationSec(cleanText, settings.speed),
        format: 'mp3' as const,
        engine: 'Neural Turbo v2.5 (Zero-Watermark)',
        ...(fallbackNotice ? { fallbackNotice } : {}),
      };
    } catch (e: any) {
      console.warn('Local Edge Neural failed:', e?.message || e);
      return null;
    }
  };

  const tryFreeTts = async () => {
    if (isLocalEnv) {
      const localRes = await tryLocalEdgeNeural();
      if (localRes) return localRes;
    }
    if (!freeTtsKey) {
      if (preferred === 'freetts-api') {
        fallbackNotice = 'API key FreeTTS belum diisi — otomatis pindah ke cadangan.';
      }
      return null;
    }
    try {
      const neuralText = await getNormalizedTextForNeural();
      const res = await synthesizeFreeTts(neuralText, voiceEdgeId, tunedSettings, freeTtsKey);
      return fallbackNotice ? { ...res, fallbackNotice } : res;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.warn('FreeTTS API failed, falling back:', msg);
      fallbackNotice = msg.includes('429')
        ? 'FreeTTS sedang limit (429) — pindah ke cadangan.'
        : 'FreeTTS gagal merespons — pindah ke cadangan.';
      return null;
    }
  };

  if (preferred === 'elevenlabs-api') {
    const r1 = await tryElevenLabs();
    if (r1) return r1;
    const r2 = await tryGemini();
    if (r2) return r2;
    const r3 = await tryFreeTts();
    if (r3) return r3;
  } else if (preferred === 'gemini-tts') {
    const r1 = await tryGemini();
    if (r1) return r1;
    const r2 = await tryElevenLabs();
    if (r2) return r2;
    const r3 = await tryFreeTts();
    if (r3) return r3;
  } else if (preferred === 'freetts-api') {
    const r1 = await tryFreeTts();
    if (r1) return r1;
    const r2 = await tryElevenLabs();
    if (r2) return r2;
    const r3 = await tryGemini();
    if (r3) return r3;
  } else {
    // Auto mode: 1. ElevenLabs (if voice is ElevenLabs or key active) / Gemini -> 2. FreeTTS / Edge Neural
    if (hints?.accent === 'ElevenLabs' && elevenKey) {
      const r0 = await tryElevenLabs();
      if (r0) return r0;
    }
    if (geminiKey) {
      const r1 = await tryGemini();
      if (r1) return r1;
    }
    if (elevenKey) {
      const r2 = await tryElevenLabs();
      if (r2) return r2;
    }
    const r3 = await tryFreeTts();
    if (r3) return r3;
  }

  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
  );

  // On Vercel/serverless, if both Gemini & FreeTTS failed/missing, Google TTS fallback has only 1 voice per language!
  if (isServerless) {
    try {
      const gRes = await synthesizeGoogleNeuralFallback(cleanText, voiceEdgeId, settings);
      return {
        ...gRes,
        fallbackNotice:
          fallbackNotice ||
          'Fallback ke Google TTS (hanya 1 suara per bahasa). Isi GEMINI_API_KEY / FREETTS_API_KEY agar suara karakter berbeda.',
      };
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
