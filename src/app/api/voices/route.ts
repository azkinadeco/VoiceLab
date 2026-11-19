import { NextRequest, NextResponse } from 'next/server';
import { getAllVoices, getCustomVoices, addCustomVoice, deleteCustomVoice } from '@/lib/storage';
import { Voice } from '@/lib/types';

export async function GET() {
  try {
    const voices = getAllVoices();
    return NextResponse.json({ voices, count: voices.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newVoice: Voice = {
      id: body.id || `voice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: body.name || 'Custom Voice',
      category: body.category || 'cloned',
      gender: body.gender || 'neutral',
      accent: body.accent || 'Neutral',
      language: body.language || 'English (US)',
      description: body.description || 'User created custom voice',
      previewUrl: body.previewUrl || '',
      avatarUrl: body.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      voiceIdEdge: body.voiceIdEdge || 'en-US-ChristopherNeural',
      labels: body.labels || { age: 'young', useCase: 'Custom', tone: 'Cloned' },
      clonedFromAudio: body.clonedFromAudio || undefined,
      createdAt: new Date().toISOString(),
    };

    addCustomVoice(newVoice);
    return NextResponse.json({ success: true, voice: newVoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing voice id' }, { status: 400 });
    }
    const success = deleteCustomVoice(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
