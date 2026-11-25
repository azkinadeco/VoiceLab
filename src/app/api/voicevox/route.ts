import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/storage';

export const runtime = 'nodejs';

export interface VoicevoxStyleOption {
  id: number;
  speakerName: string;
  styleName: string;
  label: string;
}

export async function GET(request: NextRequest) {
  const customUrl = request.nextUrl.searchParams.get('url');
  const appSettings = getAppSettings();
  const baseUrl = (customUrl || appSettings.voicevoxUrl || process.env.VOICEVOX_URL || 'http://127.0.0.1:50021').replace(
    /\/+$/,
    ''
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const [verRes, spkRes] = await Promise.all([
      fetch(`${baseUrl}/version`, { signal: controller.signal }),
      fetch(`${baseUrl}/speakers`, { signal: controller.signal }),
    ]);

    if (!verRes.ok || !spkRes.ok) {
      return NextResponse.json({
        online: false,
        baseUrl,
        error: `VOICEVOX merespons HTTP ${verRes.status}/${spkRes.status}`,
        speakers: [],
      });
    }

    const version = (await verRes.text()).replace(/"/g, '').trim();
    const rawSpeakers: any[] = await spkRes.json();
    const speakers: VoicevoxStyleOption[] = [];

    for (const spk of rawSpeakers) {
      const name = spk?.name || 'Speaker';
      for (const st of spk?.styles || []) {
        if (typeof st?.id === 'number') {
          speakers.push({
            id: st.id,
            speakerName: name,
            styleName: st.name || 'Normal',
            label: `${name} — ${st.name || 'Normal'}`,
          });
        }
      }
    }

    return NextResponse.json({
      online: true,
      baseUrl,
      version,
      count: speakers.length,
      speakers,
    });
  } catch {
    return NextResponse.json({
      online: false,
      baseUrl,
      downloadUrl: 'https://voicevox.hiroshiba.jp/',
      speakers: [],
    });
  } finally {
    clearTimeout(timer);
  }
}
