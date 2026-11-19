import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, clearAllGenerations, getStorageStats } from '@/lib/storage';

export async function GET() {
  try {
    const db = readDb();
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      database: db,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'clear_generations') {
      const removedCount = clearAllGenerations();
      const stats = getStorageStats();
      return NextResponse.json({
        success: true,
        removedCount,
        stats,
      });
    }

    if (body.action === 'import_backup' && body.database) {
      const current = readDb();
      const incoming = body.database;
      const merged = {
        ...current,
        customVoices: incoming.customVoices || current.customVoices,
        pronunciationRules: incoming.pronunciationRules || current.pronunciationRules,
        projects: incoming.projects || current.projects,
        agents: incoming.agents || current.agents,
        dubbings: incoming.dubbings || current.dubbings,
        generations: incoming.generations || current.generations,
      };
      writeDb(merged);
      return NextResponse.json({
        success: true,
        stats: getStorageStats(),
      });
    }

    return NextResponse.json({ error: 'Invalid backup action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
