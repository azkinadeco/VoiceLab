import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientKeys = body?.clientKeys || {};
    const saved = getAppSettings();
    const elevenKey = (
      clientKeys.elevenLabsApiKey ||
      saved.elevenLabsApiKey ||
      process.env.ELEVENLABS_API_KEY ||
      ''
    ).trim();

    if (!elevenKey) {
      return NextResponse.json({
        elevenlabs: { configured: false, used: 0, limit: 10000, remaining: 10000, percent: 0 },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        signal: controller.signal,
        headers: { 'xi-api-key': elevenKey },
      });
      if (!res.ok) {
        return NextResponse.json({
          elevenlabs: { configured: true, used: 0, limit: 10000, remaining: 10000, percent: 0 },
        });
      }
      const sub = await res.json();
      const used = Number(sub?.character_count) || 0;
      const limit = Number(sub?.character_limit) || 10000;
      const remaining = Math.max(0, limit - used);
      const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return NextResponse.json({
        elevenlabs: {
          configured: true,
          used,
          limit,
          remaining,
          percent,
          tier: sub?.tier || 'free',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json({
      elevenlabs: { configured: false, used: 0, limit: 10000, remaining: 10000, percent: 0 },
    });
  }
}
