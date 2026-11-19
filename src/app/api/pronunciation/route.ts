import { NextRequest, NextResponse } from 'next/server';
import {
  getPronunciationRules,
  savePronunciationRule,
  deletePronunciationRule,
} from '@/lib/storage';
import { PronunciationRule } from '@/lib/types';

export async function GET() {
  try {
    const rules = getPronunciationRules();
    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rule: PronunciationRule = {
      id: body.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      word: body.word?.trim() || '',
      replacement: body.replacement?.trim() || '',
      phonetic: body.phonetic?.trim() || '',
      language: body.language || 'All',
      caseSensitive: Boolean(body.caseSensitive),
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      createdAt: body.createdAt || new Date().toISOString(),
    };

    if (!rule.word || !rule.replacement) {
      return NextResponse.json({ error: 'Word and replacement are required' }, { status: 400 });
    }

    const saved = savePronunciationRule(rule);
    return NextResponse.json({ success: true, rule: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing rule id' }, { status: 400 });
    }
    const success = deletePronunciationRule(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
