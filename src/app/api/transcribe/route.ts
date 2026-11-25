import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODELS_DIR = path.join(process.cwd(), 'data', 'models');
const MODEL_ID = process.env.WHISPER_MODEL || 'onnx-community/whisper-base';

// Keep a single pipeline instance across requests (and across dev hot-reloads)
const g = globalThis as any;

async function getTranscriber() {
  if (!g.__voicelabWhisper) {
    g.__voicelabWhisper = (async () => {
      if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = MODELS_DIR;
      env.allowLocalModels = true;
      return pipeline('automatic-speech-recognition', MODEL_ID, { dtype: 'q8' as any });
    })().catch((err: any) => {
      g.__voicelabWhisper = null;
      throw err;
    });
  }
  return g.__voicelabWhisper;
}

function mapLanguage(lang: string): string | undefined {
  const l = (lang || '').toLowerCase();
  if (!l || l === 'auto') return undefined;
  if (l.includes('indonesia') || l.includes('jawa') || l.includes('sunda') || l === 'id') return 'indonesian';
  if (l.includes('english') || l.includes('american') || l.includes('british') || l.includes('australian') || l === 'en') return 'english';
  if (l.includes('japan')) return 'japanese';
  if (l.includes('korea')) return 'korean';
  if (l.includes('arab')) return 'arabic';
  if (l.includes('mandarin') || l.includes('chinese')) return 'chinese';
  if (l.includes('spanish')) return 'spanish';
  if (l.includes('french')) return 'french';
  if (l.includes('german')) return 'german';
  if (l.includes('hindi')) return 'hindi';
  return undefined;
}

/** GET: report whether the local Whisper model is already downloaded */
export async function GET() {
  const modelDir = path.join(MODELS_DIR, ...MODEL_ID.split('/'));
  return NextResponse.json({
    model: MODEL_ID,
    downloaded: fs.existsSync(modelDir),
    loaded: Boolean(g.__voicelabWhisper),
  });
}

/**
 * POST { pcmBase64: base64 Float32 PCM @16kHz mono, language?: string }
 * Runs Whisper fully on this machine (model is cached in data/models after first download).
 */
export async function POST(request: NextRequest) {
  try {
    const { pcmBase64, language } = await request.json();
    if (!pcmBase64 || typeof pcmBase64 !== 'string') {
      return NextResponse.json({ error: 'Audio PCM wajib dikirim' }, { status: 400 });
    }
    const buf = Buffer.from(pcmBase64, 'base64');
    const audio = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
    if (audio.length < 1600) {
      return NextResponse.json({ error: 'Audio terlalu pendek (min 0.1 detik)' }, { status: 400 });
    }

    const transcriber = await getTranscriber();
    const lang = mapLanguage(language);
    const output: any = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe',
      ...(lang ? { language: lang } : {}),
    });
    const text = (Array.isArray(output) ? output.map((o: any) => o.text).join(' ') : output?.text || '').trim();
    return NextResponse.json({ success: true, text, model: MODEL_ID });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    const msg = String(error?.message || error);
    const offline = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|network/i.test(msg);
    return NextResponse.json(
      {
        error: offline
          ? 'Model Whisper belum terunduh dan internet tidak tersedia. Sambungkan internet sekali untuk mengunduh model (~80MB), setelah itu transkripsi berjalan offline.'
          : msg,
      },
      { status: 500 }
    );
  }
}
