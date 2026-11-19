'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Voice, ConversationalAgent, Generation } from '@/lib/types';
import {
  Bot,
  Send,
  Mic,
  Square,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';

interface ConversationalAIProps {
  voices: Voice[];
  onGenerationCreated: (gen: Generation) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  audioUrl?: string;
  duration?: number;
  timestamp: string;
}

export default function ConversationalAI({ voices, onGenerationCreated }: ConversationalAIProps) {
  const [agents, setAgents] = useState<ConversationalAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<ConversationalAgent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // Builder form
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newVoiceId, setNewVoiceId] = useState(voices[0]?.id || 'voice-gadis');
  const [newLanguage, setNewLanguage] = useState('Indonesian');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');
  const [newFirstMsg, setNewFirstMsg] = useState('');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (data.agents && data.agents.length > 0) {
        setAgents(data.agents);
        selectAgent(data.agents[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectAgent = (agent: ConversationalAgent) => {
    setSelectedAgent(agent);
    setMessages([
      {
        id: `m-init-${Date.now()}`,
        sender: 'agent',
        text: agent.firstMessage,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const toggleVoiceTalk = () => {
    if (isListeningMic) {
      recognitionRef.current?.stop();
      setIsListeningMic(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Browser ini belum mendukung pengenalan suara mikrofon langsung. Silakan ketik pesan.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = selectedAgent?.language.toLowerCase().includes('indonesia')
      ? 'id-ID'
      : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInputMsg(transcript);
        handleSendMessage(transcript);
      }
    };
    rec.onend = () => {
      setIsListeningMic(false);
    };
    rec.onerror = () => {
      setIsListeningMic(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListeningMic(true);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText ?? inputMsg).trim();
    if (!textToSend || !selectedAgent || isResponding) return;

    const userMsg: ChatMessage = {
      id: `m-u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMsg('');
    setIsResponding(true);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          agentId: selectedAgent.id,
          message: textToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const agentMsg: ChatMessage = {
        id: `m-a-${Date.now()}`,
        sender: 'agent',
        text: data.replyText,
        audioUrl: data.audioUrl,
        duration: data.duration,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, agentMsg]);
      if (data.generation) {
        onGenerationCreated(data.generation);
      }
    } catch (e: any) {
      alert('Gagal memproses respons agen: ' + e.message);
    } finally {
      setIsResponding(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newName.trim()) return;
    try {
      const targetVoice = voices.find((v) => v.id === newVoiceId) || voices[0];
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          role: newRole.trim() || 'AI Voice Assistant',
          voiceId: newVoiceId,
          language: newLanguage,
          systemPrompt: newSystemPrompt.trim() || `Kamu adalah ${newName}, asisten suara AI.`,
          firstMessage: newFirstMsg.trim() || `Halo! Saya ${newName}. Ada yang bisa saya bantu?`,
          avatarUrl: targetVoice.avatarUrl,
        }),
      });
      const data = await res.json();
      if (data.agent) {
        const updated = [data.agent, ...agents];
        setAgents(updated);
        selectAgent(data.agent);
        setShowBuilder(false);
        setNewName('');
        setNewRole('');
        setNewSystemPrompt('');
        setNewFirstMsg('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (agents.length <= 1) return;
    await fetch(`/api/agents?id=${id}`, { method: 'DELETE' });
    const remaining = agents.filter((a) => a.id !== id);
    setAgents(remaining);
    if (selectedAgent?.id === id && remaining[0]) {
      selectAgent(remaining[0]);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Conversational AI Voice Agents</h1>
          <TooltipInfo
            title="Live Voice Agent"
            text="Pilih agen asisten atau buat agen baru. Anda dapat mengobrol menggunakan mikrofon (Push-to-Talk) atau ketik teks, dan agen akan menjawab dengan suara neural."
            position="right"
          />
        </div>

        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus className="h-4 w-4" />
          {showBuilder ? 'Tutup Form' : 'Buat Agen Baru'}
        </button>
      </div>

      {/* Collapsible Builder Form */}
      {showBuilder && (
        <div className="studio-card rounded-2xl border-cyan-500/30 p-5 space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Nama Agen (cth: Dr. Maya) *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Peran (cth: Konsultan Produk)"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs text-white"
            />
            <select
              value={newVoiceId}
              onChange={(e) => setNewVoiceId(e.target.value)}
              className="rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.accent})
                </option>
              ))}
            </select>
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              className="rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              <option value="Indonesian">Indonesian</option>
              <option value="English (US)">English (US)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Sapaan Pertama (cth: Halo! Ada yang bisa saya bantu?)"
              value={newFirstMsg}
              onChange={(e) => setNewFirstMsg(e.target.value)}
              className="rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Instruksi Karakter (System Prompt singkat)"
              value={newSystemPrompt}
              onChange={(e) => setNewSystemPrompt(e.target.value)}
              className="rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs text-white"
            />
          </div>

          <button
            onClick={handleCreateAgent}
            disabled={!newName.trim()}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-black hover:bg-cyan-400 disabled:opacity-40"
          >
            Simpan & Aktifkan
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Compact Agent Pills */}
        <div className="lg:col-span-4 space-y-2.5">
          {agents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id;
            const voice = voices.find((v) => v.id === agent.voiceId);
            return (
              <div
                key={agent.id}
                onClick={() => selectAgent(agent)}
                className={`rounded-2xl p-3.5 border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/10'
                    : 'studio-card hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={agent.avatarUrl}
                        alt={agent.name}
                        className="h-11 w-11 rounded-full object-cover border border-white/15"
                      />
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-dark-900" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{agent.name}</h4>
                      <p className="text-xs text-dark-300 truncate">
                        {voice?.name || 'Neural'} • {agent.language}
                      </p>
                    </div>
                  </div>
                  {agents.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAgent(agent.id);
                      }}
                      className="text-dark-400 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Active Voice Conversation Window */}
        <div className="lg:col-span-8 studio-card rounded-2xl flex flex-col h-[520px] overflow-hidden">
          {selectedAgent && (
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 bg-dark-950/60">
              <div className="flex items-center gap-3">
                <img
                  src={selectedAgent.avatarUrl}
                  alt={selectedAgent.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{selectedAgent.name}</h4>
                  <span className="text-xs text-emerald-400">● Live</span>
                  <TooltipInfo
                    title={selectedAgent.role}
                    text={selectedAgent.systemPrompt}
                    position="bottom"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-lg rounded-2xl p-3.5 text-sm space-y-2 ${
                    m.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-br-none'
                      : 'bg-dark-850 border border-white/10 text-dark-100 rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed">{m.text}</p>
                  {m.audioUrl && (
                    <div className="pt-1 min-w-[260px] sm:min-w-[320px]">
                      <AudioWaveVisualizer
                        audioUrl={m.audioUrl}
                        duration={m.duration}
                        autoPlay
                        compact
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isResponding && (
              <div className="flex items-center gap-2 text-xs text-cyan-400 animate-pulse">
                <Sparkles className="h-4 w-4" />
                Menyintesis balasan suara...
              </div>
            )}
          </div>

          {/* Quick Questions */}
          <div className="px-4 py-2 bg-dark-950/40 border-t border-white/5 flex items-center gap-2 overflow-x-auto">
            {[
              'Bagaimana cara kloning suara?',
              'Apakah semua fitur gratis di PC?',
              'Tips agar narasi natural',
            ].map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isResponding}
                className="rounded-lg bg-dark-850 border border-white/10 px-2.5 py-1 text-xs text-dark-200 hover:text-white hover:border-cyan-500/40 shrink-0 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input & Live Mic Bar */}
          <div className="p-3 border-t border-white/10 bg-dark-950 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceTalk}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                isListeningMic
                  ? 'bg-rose-500 border-rose-400 text-white animate-pulse'
                  : 'bg-dark-850 border-white/10 text-cyan-400 hover:bg-dark-800'
              }`}
              title={isListeningMic ? 'Berhenti bicara' : 'Bicara langsung via Mikrofon'}
            >
              {isListeningMic ? <Square className="h-4 w-4 fill-white" /> : <Mic className="h-4 w-4" />}
            </button>

            <input
              type="text"
              placeholder={
                isListeningMic
                  ? 'Mendengarkan suara Anda...'
                  : `Ketik atau klik mic untuk bicara ke ${selectedAgent?.name || 'Agent'}...`
              }
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              className="flex-1 rounded-xl bg-dark-850 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-dark-400 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isResponding || !inputMsg.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-cyan-400 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
