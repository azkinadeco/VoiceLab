export interface Voice {
  id: string;
  name: string;
  category: 'premade' | 'cloned' | 'designed';
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  language: string;
  description: string;
  previewUrl?: string;
  avatarUrl: string;
  avatarGradient?: string;
  avatarEmoji?: string;
  voiceIdEdge: string;
  labels: {
    age?: 'young' | 'middle-aged' | 'old';
    useCase?: string;
    tone?: string;
    gender?: string;
  };
  clonedFromAudio?: string;
  pitchOffset?: number;
  createdAt: string;
  isFavorite?: boolean;
}

export interface GenerationSettings {
  speed: number; // 0.5 to 2.0
  pitch: number; // -50Hz to +50Hz or semitones
  stability: number; // 0 to 100
  similarity: number; // 0 to 100
  styleExaggeration: number; // 0 to 100
  speakerBoost: boolean;
}

export interface Generation {
  id: string;
  text: string;
  voiceId: string;
  voiceName: string;
  voiceAvatar: string;
  audioUrl: string;
  duration: number; // seconds
  createdAt: string;
  model: string;
  type: 'tts' | 'speech-to-speech' | 'sfx' | 'isolated' | 'studio' | 'dubbing' | 'project' | 'batch' | 'agent';
  fileSize: number; // bytes
  starred: boolean;
  settings: GenerationSettings;
  srtSubtitle?: string;
}

export interface StudioBlock {
  id: string;
  characterName: string;
  voiceId: string;
  text: string;
  audioUrl?: string;
  duration?: number;
  pauseAfterMs: number;
}

export interface SoundEffectGeneration {
  id: string;
  prompt: string;
  duration: number;
  audioUrl: string;
  createdAt: string;
}

export interface PronunciationRule {
  id: string;
  word: string;
  replacement: string;
  phonetic?: string;
  language: string;
  caseSensitive: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface AudiobookChapter {
  id: string;
  title: string;
  content: string;
  voiceId: string;
  audioUrl?: string;
  duration?: number;
  status: 'draft' | 'generating' | 'completed';
}

export interface AudiobookProject {
  id: string;
  title: string;
  author: string;
  description: string;
  defaultVoiceId: string;
  chapters: AudiobookChapter[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationalAgent {
  id: string;
  name: string;
  role: string;
  voiceId: string;
  systemPrompt: string;
  firstMessage: string;
  language: string;
  avatarUrl: string;
  createdAt: string;
}

export interface DubbingProject {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  voiceId: string;
  audioUrl?: string;
  srtContent?: string;
  duration?: number;
  createdAt: string;
}

export interface AppSettings {
  ttsProvider: 'edge-neural' | 'freetts-api' | 'elevenlabs-api' | 'openai-api' | 'browser-speech';
  freeTtsApiKey?: string;
  elevenLabsApiKey?: string;
  openAiApiKey?: string;
  audioFormat: 'mp3' | 'wav';
  applyPronunciationRules?: boolean;
  autoMasterAudio?: boolean;
  storageStats: {
    totalGenerations: number;
    diskUsageBytes: number;
  };
}
