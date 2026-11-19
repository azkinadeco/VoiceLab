import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_AUDIO_DIR = path.join(process.cwd(), 'data', 'audio');

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
    const contentType =
      ext === '.wav' ? 'audio/wav' : ext === '.ogg' ? 'audio/ogg' : 'audio/mpeg';

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
