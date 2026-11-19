import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings, updateAppSettings, getStorageStats } from '@/lib/storage';

export async function GET() {
  try {
    const settings = getAppSettings();
    const stats = getStorageStats();
    return NextResponse.json({ settings, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = updateAppSettings(body);
    const stats = getStorageStats();
    return NextResponse.json({ success: true, settings: updated, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
