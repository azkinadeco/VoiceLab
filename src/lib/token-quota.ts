import { Generation } from './types';

export const GEMINI_DAILY_TOKEN_LIMIT = 15000;
export const FREETTS_MONTHLY_TOKEN_LIMIT = 50000;
export const ELEVENLABS_DEFAULT_LIMIT = 10000;

export interface ProviderQuotaItem {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  rateLimited: boolean;
}

export interface TokenQuotaSnapshot {
  gemini: ProviderQuotaItem;
  freetts: ProviderQuotaItem;
  elevenlabs: ProviderQuotaItem;
}

interface StoredUsageData {
  dayKey: string;
  monthKey: string;
  geminiUsedToday: number;
  geminiRateLimitedToday: boolean;
  freettsUsedMonth: number;
  freettsRateLimited: boolean;
  elevenUsedMonth: number;
  elevenLimitMonth: number;
  elevenRateLimited: boolean;
}

const STORAGE_KEY = 'voicelab_token_quota_v1';

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function estimateScriptTokens(text: string, engine: 'gemini' | 'freetts' | 'elevenlabs' = 'gemini'): number {
  const clean = (text || '').trim();
  if (!clean) return 0;
  if (engine === 'elevenlabs') {
    return clean.length; // ElevenLabs bills 1 character = 1 credit/token
  }
  if (engine === 'gemini') {
    return Math.min(GEMINI_DAILY_TOKEN_LIMIT, 850 + Math.ceil(clean.length * 2.5));
  }
  return Math.min(FREETTS_MONTHLY_TOKEN_LIMIT, 180 + Math.ceil(clean.length * 3));
}

function loadStoredUsage(): StoredUsageData {
  const today = getTodayKey();
  const month = getMonthKey();
  const fallback: StoredUsageData = {
    dayKey: today,
    monthKey: month,
    geminiUsedToday: 0,
    geminiRateLimitedToday: false,
    freettsUsedMonth: 0,
    freettsRateLimited: false,
    elevenUsedMonth: 0,
    elevenLimitMonth: ELEVENLABS_DEFAULT_LIMIT,
    elevenRateLimited: false,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredUsageData>;
    return {
      dayKey: today,
      monthKey: month,
      geminiUsedToday: parsed.dayKey === today ? Number(parsed.geminiUsedToday) || 0 : 0,
      geminiRateLimitedToday: parsed.dayKey === today ? Boolean(parsed.geminiRateLimitedToday) : false,
      freettsUsedMonth: parsed.monthKey === month ? Number(parsed.freettsUsedMonth) || 0 : 0,
      freettsRateLimited: parsed.monthKey === month ? Boolean(parsed.freettsRateLimited) : false,
      elevenUsedMonth: parsed.monthKey === month ? Number(parsed.elevenUsedMonth) || 0 : 0,
      elevenLimitMonth: Number(parsed.elevenLimitMonth) || ELEVENLABS_DEFAULT_LIMIT,
      elevenRateLimited: parsed.monthKey === month ? Boolean(parsed.elevenRateLimited) : false,
    };
  } catch {
    return fallback;
  }
}

function saveStoredUsage(data: StoredUsageData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('voicelab-quota-updated'));
  } catch {}
}

export function syncElevenLabsLiveQuota(used: number, limit: number) {
  if (typeof window === 'undefined') return;
  const stored = loadStoredUsage();
  stored.elevenUsedMonth = Math.max(0, used);
  stored.elevenLimitMonth = Math.max(1000, limit || ELEVENLABS_DEFAULT_LIMIT);
  stored.elevenRateLimited = used >= stored.elevenLimitMonth;
  saveStoredUsage(stored);
}

export async function syncLiveElevenQuota(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    let clientKeys = {};
    try {
      clientKeys = JSON.parse(localStorage.getItem('voicelab_client_keys') || '{}');
    } catch {}
    const res = await fetch('/api/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKeys }),
    });
    const d = await res.json();
    if (d?.elevenlabs?.configured && typeof d.elevenlabs.used === 'number') {
      syncElevenLabsLiveQuota(d.elevenlabs.used, d.elevenlabs.limit);
    }
  } catch {}
}

export function recordTokenUsage(params: {
  engineLabel?: string;
  text: string;
  fallbackNotice?: string | null;
}) {
  if (typeof window === 'undefined') return;
  const stored = loadStoredUsage();
  const model = (params.engineLabel || '').toLowerCase();
  const notice = (params.fallbackNotice || '').toLowerCase();

  if (notice.includes('gemini') && notice.includes('429')) {
    stored.geminiRateLimitedToday = true;
    stored.geminiUsedToday = Math.max(stored.geminiUsedToday, GEMINI_DAILY_TOKEN_LIMIT);
  }
  if (notice.includes('freetts') && notice.includes('429')) {
    stored.freettsRateLimited = true;
  }
  if (notice.includes('elevenlabs') && (notice.includes('429') || notice.includes('quota'))) {
    stored.elevenRateLimited = true;
  }

  if (model.includes('gemini')) {
    stored.geminiUsedToday = Math.min(
      GEMINI_DAILY_TOKEN_LIMIT,
      stored.geminiUsedToday + estimateScriptTokens(params.text, 'gemini')
    );
    stored.geminiRateLimitedToday = false;
  } else if (model.includes('freetts')) {
    stored.freettsUsedMonth = Math.min(
      FREETTS_MONTHLY_TOKEN_LIMIT,
      stored.freettsUsedMonth + estimateScriptTokens(params.text, 'freetts')
    );
  } else if (model.includes('elevenlabs')) {
    stored.elevenUsedMonth = Math.min(
      stored.elevenLimitMonth,
      stored.elevenUsedMonth + estimateScriptTokens(params.text, 'elevenlabs')
    );
  }

  saveStoredUsage(stored);
}

export function resetTokenQuota(target: 'gemini' | 'freetts' | 'elevenlabs' | 'all' = 'all') {
  const stored = loadStoredUsage();
  if (target === 'gemini' || target === 'all') {
    stored.geminiUsedToday = 0;
    stored.geminiRateLimitedToday = false;
  }
  if (target === 'freetts' || target === 'all') {
    stored.freettsUsedMonth = 0;
    stored.freettsRateLimited = false;
  }
  if (target === 'elevenlabs' || target === 'all') {
    stored.elevenUsedMonth = 0;
    stored.elevenRateLimited = false;
  }
  saveStoredUsage(stored);
}

export function computeTokenQuota(generations: Generation[] = []): TokenQuotaSnapshot {
  const stored = loadStoredUsage();
  const today = getTodayKey();
  const month = getMonthKey();

  let dbGeminiToday = 0;
  let dbFreettsMonth = 0;
  let dbElevenMonth = 0;

  for (const gen of generations) {
    const model = (gen.model || '').toLowerCase();
    const created = gen.createdAt ? new Date(gen.createdAt) : null;
    const isToday =
      created && !isNaN(created.getTime())
        ? `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}` === today
        : false;
    const isThisMonth =
      created && !isNaN(created.getTime())
        ? `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}` === month
        : true;

    if (model.includes('gemini') && isToday) {
      dbGeminiToday += estimateScriptTokens(gen.text || '', 'gemini');
    } else if (model.includes('freetts') && isThisMonth) {
      dbFreettsMonth += estimateScriptTokens(gen.text || '', 'freetts');
    } else if (model.includes('elevenlabs') && isThisMonth) {
      dbElevenMonth += estimateScriptTokens(gen.text || '', 'elevenlabs');
    }
  }

  const geminiUsed = stored.geminiRateLimitedToday
    ? GEMINI_DAILY_TOKEN_LIMIT
    : Math.min(GEMINI_DAILY_TOKEN_LIMIT, Math.max(stored.geminiUsedToday, dbGeminiToday));

  const freettsUsed = stored.freettsRateLimited
    ? FREETTS_MONTHLY_TOKEN_LIMIT
    : Math.min(FREETTS_MONTHLY_TOKEN_LIMIT, Math.max(stored.freettsUsedMonth, dbFreettsMonth));

  const elevenLimit = stored.elevenLimitMonth || ELEVENLABS_DEFAULT_LIMIT;
  const elevenUsed = stored.elevenRateLimited
    ? elevenLimit
    : Math.min(elevenLimit, Math.max(stored.elevenUsedMonth, dbElevenMonth));

  return {
    gemini: {
      used: geminiUsed,
      limit: GEMINI_DAILY_TOKEN_LIMIT,
      remaining: Math.max(0, GEMINI_DAILY_TOKEN_LIMIT - geminiUsed),
      percent: Math.min(100, Math.round((geminiUsed / GEMINI_DAILY_TOKEN_LIMIT) * 100)),
      rateLimited: stored.geminiRateLimitedToday || geminiUsed >= GEMINI_DAILY_TOKEN_LIMIT,
    },
    freetts: {
      used: freettsUsed,
      limit: FREETTS_MONTHLY_TOKEN_LIMIT,
      remaining: Math.max(0, FREETTS_MONTHLY_TOKEN_LIMIT - freettsUsed),
      percent: Math.min(100, Math.round((freettsUsed / FREETTS_MONTHLY_TOKEN_LIMIT) * 100)),
      rateLimited: stored.freettsRateLimited || freettsUsed >= FREETTS_MONTHLY_TOKEN_LIMIT,
    },
    elevenlabs: {
      used: elevenUsed,
      limit: elevenLimit,
      remaining: Math.max(0, elevenLimit - elevenUsed),
      percent: Math.min(100, Math.round((elevenUsed / elevenLimit) * 100)),
      rateLimited: stored.elevenRateLimited || elevenUsed >= elevenLimit,
    },
  };
}

export function formatTokenNumber(n: number): string {
  return Math.round(n).toLocaleString('id-ID');
}
