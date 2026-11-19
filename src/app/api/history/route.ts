import { NextRequest, NextResponse } from 'next/server';
import { getGenerations, deleteGeneration, toggleStarGeneration } from '@/lib/storage';

export async function GET() {
  try {
    const list = getGenerations();
    return NextResponse.json({ generations: list, count: list.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing generation id' }, { status: 400 });
    }
    const success = deleteGeneration(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Missing generation id' }, { status: 400 });
    }
    const starred = toggleStarGeneration(id);
    return NextResponse.json({ success: true, starred });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
