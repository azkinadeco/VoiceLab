import fs from 'fs';
import path from 'path';
import {
  Generation,
  Voice,
  AppSettings,
  PronunciationRule,
  AudiobookProject,
  ConversationalAgent,
  DubbingProject,
} from './types';
import { PRESET_VOICES } from './voices-data';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

export const SUB_DIRS = {
  generations: path.join(AUDIO_DIR, 'generations'),
  voices: path.join(AUDIO_DIR, 'voices'),
  sfx: path.join(AUDIO_DIR, 'sfx'),
  isolated: path.join(AUDIO_DIR, 'isolated'),
  studio: path.join(AUDIO_DIR, 'studio'),
  dubbing: path.join(AUDIO_DIR, 'dubbing'),
  projects: path.join(AUDIO_DIR, 'projects'),
};

export interface LocalDatabase {
  generations: Generation[];
  customVoices: Voice[];
  pronunciationRules: PronunciationRule[];
  projects: AudiobookProject[];
  agents: ConversationalAgent[];
  dubbings: DubbingProject[];
  settings: AppSettings;
}

const DEFAULT_PRONUNCIATION_RULES: PronunciationRule[] = [
  {
    id: 'rule-1',
    word: 'ElevenLabs',
    replacement: 'Eleven Labs',
    phonetic: 'ɪˈlɛvən læbz',
    language: 'All',
    caseSensitive: false,
    enabled: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'rule-2',
    word: 'AI',
    replacement: 'A.I.',
    phonetic: 'eɪ aɪ',
    language: 'All',
    caseSensitive: true,
    enabled: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'rule-3',
    word: 'UMKM',
    replacement: 'U M K M',
    phonetic: 'u em ka em',
    language: 'Indonesian',
    caseSensitive: true,
    enabled: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const DEFAULT_AGENTS: ConversationalAgent[] = [
  {
    id: 'agent-support-id',
    name: 'Nadia (Customer Success ID)',
    role: 'Asisten Layanan Pelanggan & Produk',
    voiceId: 'voice-gadis',
    systemPrompt: 'Kamu adalah Nadia, asisten AI berbahasa Indonesia yang ramah, solutif, dan membantu menjawab pertanyaan pengguna dengan ringkas.',
    firstMessage: 'Halo! Saya Nadia dari Voice Lab. Ada yang bisa saya bantu hari ini?',
    language: 'Indonesian',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'agent-coach-en',
    name: 'Marcus (Executive Coach)',
    role: 'Leadership & Storytelling Mentor',
    voiceId: 'voice-adam',
    systemPrompt: 'You are Marcus, an articulate executive coach helping founders refine their pitch and communication skills.',
    firstMessage: 'Welcome! Ready to practice your keynote pitch or brainstorm your next project?',
    language: 'English (US)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const DEFAULT_PROJECTS: AudiobookProject[] = [
  {
    id: 'proj-sample-1',
    title: 'Masa Depan Suara Sintetis Nusantara',
    author: 'Voice Lab Studio',
    description: 'Buku audio interaktif tentang revolusi teknologi audio dan kecerdasan buatan.',
    defaultVoiceId: 'voice-ardi',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    chapters: [
      {
        id: 'chap-1',
        title: 'Bab 1: Era Baru Audio Digital',
        content: 'Di sebuah pagi yang cerah di Jakarta, ribuan kreator mulai menyadari bahwa suara bukan lagi sekadar gelombang udara, melainkan medium seni yang dapat dipahat dengan presisi tinggi.',
        voiceId: 'voice-ardi',
        status: 'draft',
      },
      {
        id: 'chap-2',
        title: 'Bab 2: Harmoni Bahasa Daerah',
        content: 'Dari pesisir Jawa hingga pegunungan Parahyangan, setiap aksen menyimpan identitas budaya yang kaya. Teknologi neural kini mampu melestarikan nuansa tutur tersebut untuk generasi mendatang.',
        voiceId: 'voice-gadis',
        status: 'draft',
      },
    ],
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  ttsProvider: 'edge-neural',
  audioFormat: 'mp3',
  applyPronunciationRules: true,
  autoMasterAudio: true,
  storageStats: {
    totalGenerations: 0,
    diskUsageBytes: 0,
  },
};

export function initStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
  Object.values(SUB_DIRS).forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  if (!fs.existsSync(DB_PATH)) {
    const initialDb: LocalDatabase = {
      generations: [],
      customVoices: [],
      pronunciationRules: DEFAULT_PRONUNCIATION_RULES,
      projects: DEFAULT_PROJECTS,
      agents: DEFAULT_AGENTS,
      dubbings: [],
      settings: DEFAULT_SETTINGS,
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
  }
}

export function readDb(): LocalDatabase {
  initStorage();
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      generations: parsed.generations || [],
      customVoices: parsed.customVoices || [],
      pronunciationRules: parsed.pronunciationRules || DEFAULT_PRONUNCIATION_RULES,
      projects: parsed.projects || DEFAULT_PROJECTS,
      agents: parsed.agents || DEFAULT_AGENTS,
      dubbings: parsed.dubbings || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch (err) {
    console.error('Error reading db.json, returning default structure:', err);
    return {
      generations: [],
      customVoices: [],
      pronunciationRules: DEFAULT_PRONUNCIATION_RULES,
      projects: DEFAULT_PROJECTS,
      agents: DEFAULT_AGENTS,
      dubbings: [],
      settings: DEFAULT_SETTINGS,
    };
  }
}

export function writeDb(data: LocalDatabase): void {
  initStorage();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to db.json:', err);
  }
}

export function getAllVoices(): Voice[] {
  const db = readDb();
  return [...PRESET_VOICES, ...(db.customVoices || [])];
}

export function getCustomVoices(): Voice[] {
  const db = readDb();
  return db.customVoices || [];
}

export function addCustomVoice(voice: Voice): Voice {
  const db = readDb();
  db.customVoices = [voice, ...(db.customVoices || [])];
  writeDb(db);
  return voice;
}

export function deleteCustomVoice(id: string): boolean {
  const db = readDb();
  const initialLen = db.customVoices.length;
  db.customVoices = db.customVoices.filter((v) => v.id !== id);
  if (db.customVoices.length !== initialLen) {
    writeDb(db);
    return true;
  }
  return false;
}

export function getGenerations(): Generation[] {
  const db = readDb();
  return db.generations || [];
}

export function addGeneration(gen: Generation): Generation {
  const db = readDb();
  db.generations = [gen, ...(db.generations || [])];
  writeDb(db);
  return gen;
}

export function deleteGeneration(id: string): boolean {
  const db = readDb();
  const target = db.generations.find((g) => g.id === id);
  if (target) {
    if (target.audioUrl.startsWith('/api/storage?file=')) {
      const fileName = target.audioUrl.replace('/api/storage?file=', '');
      const filePath = path.join(AUDIO_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Could not delete audio file:', filePath, e);
        }
      }
    }
    db.generations = db.generations.filter((g) => g.id !== id);
    writeDb(db);
    return true;
  }
  return false;
}

export function clearAllGenerations(): number {
  const db = readDb();
  const count = db.generations.length;
  for (const g of db.generations) {
    if (g.audioUrl.startsWith('/api/storage?file=')) {
      const fileName = g.audioUrl.replace('/api/storage?file=', '');
      const filePath = path.join(AUDIO_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }
  }
  db.generations = [];
  writeDb(db);
  return count;
}

export function toggleStarGeneration(id: string): boolean {
  const db = readDb();
  const target = db.generations.find((g) => g.id === id);
  if (target) {
    target.starred = !target.starred;
    writeDb(db);
    return target.starred;
  }
  return false;
}

// Pronunciation Dictionary Functions
export function getPronunciationRules(): PronunciationRule[] {
  const db = readDb();
  return db.pronunciationRules || [];
}

export function savePronunciationRule(rule: PronunciationRule): PronunciationRule {
  const db = readDb();
  const existingIdx = db.pronunciationRules.findIndex((r) => r.id === rule.id);
  if (existingIdx >= 0) {
    db.pronunciationRules[existingIdx] = rule;
  } else {
    db.pronunciationRules = [rule, ...db.pronunciationRules];
  }
  writeDb(db);
  return rule;
}

export function deletePronunciationRule(id: string): boolean {
  const db = readDb();
  const prevLen = db.pronunciationRules.length;
  db.pronunciationRules = db.pronunciationRules.filter((r) => r.id !== id);
  writeDb(db);
  return db.pronunciationRules.length !== prevLen;
}

export function applyPronunciationDictionary(text: string): string {
  const db = readDb();
  if (db.settings.applyPronunciationRules === false) return text;
  let processed = text;
  const rules = (db.pronunciationRules || []).filter((r) => r.enabled);
  for (const rule of rules) {
    if (!rule.word.trim()) continue;
    const escaped = rule.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = rule.caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`\\b${escaped}\\b`, flags);
    processed = processed.replace(regex, rule.replacement);
  }
  return processed;
}

// Audiobook Projects Functions
export function getProjects(): AudiobookProject[] {
  const db = readDb();
  return db.projects || [];
}

export function saveProject(project: AudiobookProject): AudiobookProject {
  const db = readDb();
  const idx = db.projects.findIndex((p) => p.id === project.id);
  project.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    db.projects[idx] = project;
  } else {
    db.projects = [project, ...db.projects];
  }
  writeDb(db);
  return project;
}

export function deleteProject(id: string): boolean {
  const db = readDb();
  const prev = db.projects.length;
  db.projects = db.projects.filter((p) => p.id !== id);
  writeDb(db);
  return db.projects.length !== prev;
}

// Conversational AI Agents Functions
export function getAgents(): ConversationalAgent[] {
  const db = readDb();
  return db.agents || [];
}

export function saveAgent(agent: ConversationalAgent): ConversationalAgent {
  const db = readDb();
  const idx = db.agents.findIndex((a) => a.id === agent.id);
  if (idx >= 0) {
    db.agents[idx] = agent;
  } else {
    db.agents = [agent, ...db.agents];
  }
  writeDb(db);
  return agent;
}

export function deleteAgent(id: string): boolean {
  const db = readDb();
  const prev = db.agents.length;
  db.agents = db.agents.filter((a) => a.id !== id);
  writeDb(db);
  return db.agents.length !== prev;
}

// Dubbing Projects Functions
export function getDubbings(): DubbingProject[] {
  const db = readDb();
  return db.dubbings || [];
}

export function saveDubbing(dub: DubbingProject): DubbingProject {
  const db = readDb();
  const idx = db.dubbings.findIndex((d) => d.id === dub.id);
  if (idx >= 0) {
    db.dubbings[idx] = dub;
  } else {
    db.dubbings = [dub, ...db.dubbings];
  }
  writeDb(db);
  return dub;
}

export function getAppSettings(): AppSettings {
  const db = readDb();
  return db.settings || DEFAULT_SETTINGS;
}

export function updateAppSettings(newSettings: Partial<AppSettings>): AppSettings {
  const db = readDb();
  db.settings = { ...db.settings, ...newSettings };
  writeDb(db);
  return db.settings;
}

function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let size = 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else {
      size += stat.size;
    }
  }
  return size;
}

export function getStorageStats() {
  initStorage();
  const db = readDb();
  const generations = db.generations || [];
  const totalGenerations = generations.length;
  const totalVoices = getAllVoices().length;
  const diskUsageBytes = getDirectorySize(DATA_DIR);

  const totalCharacters = generations.reduce((acc, g) => acc + (g.text?.length || 0), 0);
  const totalDurationSec = generations.reduce((acc, g) => acc + (g.duration || 0), 0);

  // Breakdown by type
  const byType: Record<string, number> = {};
  const byVoice: Record<string, number> = {};
  for (const g of generations) {
    const t = g.type || 'tts';
    byType[t] = (byType[t] || 0) + 1;
    byVoice[g.voiceName] = (byVoice[g.voiceName] || 0) + 1;
  }

  return {
    totalGenerations,
    totalVoices,
    totalCharacters,
    totalDurationSec: Math.round(totalDurationSec * 10) / 10,
    byType,
    byVoice,
    diskUsageBytes,
    diskUsageFormatted: (diskUsageBytes / (1024 * 1024)).toFixed(2) + ' MB',
    storagePath: DATA_DIR,
  };
}

export async function saveAudioFile(
  buffer: Buffer,
  category: keyof typeof SUB_DIRS,
  filename: string
): Promise<{ filePath: string; relativeUrl: string }> {
  initStorage();
  const targetDir = SUB_DIRS[category];
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, buffer);
  const relativeUrl = `/api/storage?file=${category}/${filename}`;
  return { filePath, relativeUrl };
}
