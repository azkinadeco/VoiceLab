import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { saveAudioFile, addGeneration, SUB_DIRS } from '@/lib/storage';
import { Generation } from '@/lib/types';

const DATA_AUDIO_DIR = path.join(process.cwd(), 'data', 'audio');

const AVATARS: Record<string, string> = {
  'speech-to-speech':
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#8b5cf6"/><text x="60" y="70" text-anchor="middle" font-size="40">🎭</text></svg>'
    ),
  default:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#0ea5e9"/><text x="60" y="70" text-anchor="middle" font-size="40">✂️</text></svg>'
    ),
};

/**
 * POST: save a client-rendered audio file (trimmer, voice changer, etc.) into local storage
 * and register it in history.
 * Body: { audioBase64, category?, filename?, type?, text?, voiceName?, voiceId?, duration?, model? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      audioBase64,
      category = 'generations',
      filename,
      type = 'tts',
      text,
      voiceName,
      voiceId,
      voiceAvatar,
      duration = 0,
      model,
    } = body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return NextResponse.json({ error: 'audioBase64 wajib diisi' }, { status: 400 });
    }
    const cat = (Object.keys(SUB_DIRS) as (keyof typeof SUB_DIRS)[]).includes(category) ? category : 'generations';
    const mime = (audioBase64.match(/^data:(audio\/[\w.+-]+)/) || [])[1] || '';
    const buffer = Buffer.from(audioBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length < 64) {
      return NextResponse.json({ error: 'File audio kosong' }, { status: 400 });
    }
    const isWav = buffer.slice(0, 4).toString('ascii') === 'RIFF' || mime.includes('wav');
    const ext = isWav ? 'wav' : mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'mp3';
    const id = `${type === 'speech-to-speech' ? 'vc' : 'edit'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const safeBase = String(filename || id)
      .replace(/\.[^/.]+$/, '')
      .replace(/[^\w.-]+/g, '-')
      .slice(0, 80);
    const finalName = `${safeBase}-${Date.now()}.${ext}`;
    const { relativeUrl } = await saveAudioFile(buffer, cat, finalName);

    const gen: Generation = {
      id,
      text: String(text || safeBase),
      voiceId: voiceId || 'local-edit',
      voiceName: voiceName || 'Audio Editor',
      voiceAvatar: voiceAvatar || AVATARS[type] || AVATARS.default,
      audioUrl: relativeUrl,
      duration: Math.round((Number(duration) || 0) * 10) / 10,
      createdAt: new Date().toISOString(),
      model: model || 'Local DSP (Browser)',
      type,
      fileSize: buffer.length,
      starred: false,
      settings: { speed: 1, pitch: 0, stability: 100, similarity: 100, styleExaggeration: 0, speakerBoost: false },
    };
    addGeneration(gen);
    return NextResponse.json({ success: true, url: relativeUrl, generation: gen });
  } catch (err: any) {
    console.error('Storage save error:', err);
    return NextResponse.json({ error: err.message || 'Gagal menyimpan audio' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const file = searchParams.get('file');

  if (!file) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  // Prevent path traversal attacks
  const normalizedPath = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(DATA_AUDIO_DIR, normalizedPath);

  if (!filePath.startsWith(DATA_AUDIO_DIR) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    if (fileSize === 0) {
      return NextResponse.json({ error: 'Empty audio file' }, { status: 404 });
    }

    const range = request.headers.get('range');
    const ext = path.extname(filePath).toLowerCase();
    // Sniff real container (older files may be WAV saved with .mp3 extension)
    const head = Buffer.alloc(4);
    const fdHead = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fdHead, head, 0, 4, 0);
    } finally {
      fs.closeSync(fdHead);
    }
    const magic = head.toString('ascii');
    const contentType =
      magic === 'RIFF' || ext === '.wav'
        ? 'audio/wav'
        : magic === 'OggS' || ext === '.ogg'
          ? 'audio/ogg'
          : ext === '.webm' || head.readUInt32BE(0) === 0x1a45dfa3
            ? 'audio/webm'
            : 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = Math.max(0, parseInt(parts[0], 10) || 0);
      const end = parts[1] ? Math.min(fileSize - 1, parseInt(parts[1], 10)) : fileSize - 1;

      if (start >= fileSize || start > end) {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const buffer = Buffer.alloc(chunkSize);
      const fd = fs.openSync(filePath, 'r');
      try {
        fs.readSync(fd, buffer, 0, chunkSize, start);
      } finally {
        fs.closeSync(fd);
      }

      return new Response(new Uint8Array(buffer), {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    const fullBuffer = fs.readFileSync(filePath);
    return new Response(new Uint8Array(fullBuffer), {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (err: any) {
    console.error('Storage read error:', err);
    return NextResponse.json({ error: 'Failed to read audio file' }, { status: 500 });
  }
}
