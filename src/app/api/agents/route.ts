import { NextRequest, NextResponse } from 'next/server';
import {
  getAgents,
  saveAgent,
  deleteAgent,
  getAllVoices,
  saveAudioFile,
  addGeneration,
  getAppSettings,
} from '@/lib/storage';
import { synthesizeSpeech } from '@/lib/tts-engine';
import { ConversationalAgent, Generation } from '@/lib/types';

function generateAgentReply(userMessage: string, agent: ConversationalAgent): string {
  const msg = userMessage.toLowerCase();
  const isIndo = agent.language.toLowerCase().includes('indonesia');

  if (isIndo) {
    if (msg.includes('harga') || msg.includes('biaya') || msg.includes('gratis')) {
      return `Tentu! Di Voice Lab ini, seluruh fitur sintesis suara, kloning, dubbing, dan efek suara dapat Anda gunakan sepenuhnya secara gratis di komputer lokal Anda tanpa biaya langganan.`;
    }
    if (msg.includes('clone') || msg.includes('klon')) {
      return `Untuk mengkloning suara, Anda cukup membuka menu Voice Lab di sebelah kiri, rekam suara Anda selama 15 detik atau unggah file MP3, lalu klik Kloning Suara.`;
    }
    if (msg.includes('halo') || msg.includes('hai') || msg.includes('pagi')) {
      return `Halo kembali! Senang berbicara dengan Anda. Saya ${agent.name}, siap membantu Anda mengeksplorasi produksi suara AI hari ini.`;
    }
    return `Terima kasih atas pertanyaan Anda mengenai "${userMessage}". Sebagai ${agent.role}, saya menyarankan Anda mengoptimalkan pengaturan Stability di angka 75 persen dan Similarity di 85 persen agar artikulasi terdengar paling natural.`;
  } else {
    if (msg.includes('price') || msg.includes('cost') || msg.includes('free')) {
      return `Great news! Voice Lab runs locally on your desktop machine, so you get unlimited neural voice generation, cloning, and studio dubbing at zero cost.`;
    }
    if (msg.includes('hello') || msg.includes('hi')) {
      return `Hello there! I am ${agent.name}, your ${agent.role}. How can we elevate your project today?`;
    }
    return `That's a great point about "${userMessage}". From my perspective as your ${agent.role}, focusing on clear pacing and expressive vocal tone will make your message resonate strongly with your audience.`;
  }
}

export async function GET() {
  try {
    const agents = getAgents();
    return NextResponse.json({ agents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'chat') {
      const { agentId, message } = body;
      const agents = getAgents();
      const agent = agents.find((a) => a.id === agentId) || agents[0];
      if (!message || !message.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }

      const replyText = generateAgentReply(message.trim(), agent);
      const voices = getAllVoices();
      const voice = voices.find((v) => v.id === agent.voiceId) || voices[0];
      const appSettings = getAppSettings();

      const { buffer, duration, format } = await synthesizeSpeech(
        replyText,
        voice.voiceIdEdge,
        {
          speed: 1.05,
          pitch: 0,
          stability: 80,
          similarity: 85,
          styleExaggeration: 0,
          speakerBoost: true,
        },
        appSettings
      );

      const fileName = `agent-${agent.id}-${Date.now()}.${format}`;
      const { relativeUrl } = await saveAudioFile(buffer, 'generations', fileName);

      const newGen: Generation = {
        id: `agentgen-${Date.now()}`,
        text: `[${agent.name}] ${replyText}`,
        voiceId: voice.id,
        voiceName: `${agent.name} (Agent)`,
        voiceAvatar: agent.avatarUrl || voice.avatarUrl,
        audioUrl: relativeUrl,
        duration,
        createdAt: new Date().toISOString(),
        model: 'Conversational AI Real-Time v2',
        type: 'agent',
        fileSize: buffer.length,
        starred: false,
        settings: {
          speed: 1.05,
          pitch: 0,
          stability: 80,
          similarity: 85,
          styleExaggeration: 0,
          speakerBoost: true,
        },
      };
      addGeneration(newGen);

      return NextResponse.json({
        success: true,
        replyText,
        audioUrl: relativeUrl,
        duration,
        generation: newGen,
      });
    }

    const newAgent: ConversationalAgent = {
      id: body.id || `agent-${Date.now()}`,
      name: body.name || 'Custom AI Agent',
      role: body.role || 'Voice Assistant',
      voiceId: body.voiceId || 'voice-gadis',
      systemPrompt: body.systemPrompt || 'You are a helpful AI voice agent.',
      firstMessage: body.firstMessage || 'Halo! Ada yang bisa saya bantu?',
      language: body.language || 'Indonesian',
      avatarUrl:
        body.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: body.createdAt || new Date().toISOString(),
    };

    const saved = saveAgent(newAgent);
    return NextResponse.json({ success: true, agent: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing agent id' }, { status: 400 });
    }
    const success = deleteAgent(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
