'use client';

import React, { useState, useEffect } from 'react';
import { Voice, AudiobookProject, AudiobookChapter, Generation } from '@/lib/types';
import {
  Plus,
  Trash2,
  Check,
  Wand2,
  Volume2,
} from 'lucide-react';
import AudioWaveVisualizer from './AudioWaveVisualizer';
import TooltipInfo from './TooltipInfo';

interface ProjectsReaderProps {
  voices: Voice[];
  onGenerationCreated: (gen: Generation) => void;
}

export default function ProjectsReader({ voices, onGenerationCreated }: ProjectsReaderProps) {
  const [projects, setProjects] = useState<AudiobookProject[]>([]);
  const [activeProject, setActiveProject] = useState<AudiobookProject | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [synthesizingChapterId, setSynthesizingChapterId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects && data.projects.length > 0) {
        setProjects(data.projects);
        setActiveProject(data.projects[0]);
        if (data.projects[0].chapters[0]) {
          setActiveChapterId(data.projects[0].chapters[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateProject = async () => {
    const newProj: AudiobookProject = {
      id: `proj-${Date.now()}`,
      title: `Buku Audio #${projects.length + 1}`,
      author: 'Kreator Voice Lab',
      description: 'Proyek naskah buku panjang multi-bab',
      defaultVoiceId: voices[0]?.id || 'voice-ardi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [
        {
          id: `chap-${Date.now()}`,
          title: 'Bab 1: Pendahuluan',
          content: 'Tuliskan isi bab pertama buku audio atau artikel panjang Anda di sini...',
          voiceId: voices[0]?.id || 'voice-ardi',
          status: 'draft',
        },
      ],
    };

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProj),
    });
    const data = await res.json();
    if (data.project) {
      setProjects([data.project, ...projects]);
      setActiveProject(data.project);
      setActiveChapterId(data.project.chapters[0].id);
    }
  };

  const handleSaveProject = async (projToSave: AudiobookProject) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projToSave),
      });
      const data = await res.json();
      if (data.project) {
        setActiveProject(data.project);
        setProjects(projects.map((p) => (p.id === data.project.id ? data.project : p)));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddChapter = () => {
    if (!activeProject) return;
    const newChap: AudiobookChapter = {
      id: `chap-${Date.now()}`,
      title: `Bab ${activeProject.chapters.length + 1}: Judul Bab`,
      content: '',
      voiceId: activeProject.defaultVoiceId,
      status: 'draft',
    };
    const updated = {
      ...activeProject,
      chapters: [...activeProject.chapters, newChap],
    };
    setActiveProject(updated);
    setActiveChapterId(newChap.id);
    handleSaveProject(updated);
  };

  const handleRemoveChapter = (chapId: string) => {
    if (!activeProject || activeProject.chapters.length <= 1) return;
    const updatedChapters = activeProject.chapters.filter((c) => c.id !== chapId);
    const updated = { ...activeProject, chapters: updatedChapters };
    setActiveProject(updated);
    if (activeChapterId === chapId) {
      setActiveChapterId(updatedChapters[0].id);
    }
    handleSaveProject(updated);
  };

  const handleUpdateChapter = (chapId: string, changes: Partial<AudiobookChapter>) => {
    if (!activeProject) return;
    const updated = {
      ...activeProject,
      chapters: activeProject.chapters.map((c) => (c.id === chapId ? { ...c, ...changes } : c)),
    };
    setActiveProject(updated);
  };

  const handleSynthesizeChapter = async (chapId: string) => {
    if (!activeProject) return;
    await handleSaveProject(activeProject);
    setSynthesizingChapterId(chapId);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'synthesize_chapter',
          projectId: activeProject.id,
          chapterId: chapId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActiveProject(data.project);
      setProjects(projects.map((p) => (p.id === data.project.id ? data.project : p)));
      if (data.generation) {
        onGenerationCreated(data.generation);
      }
    } catch (e: any) {
      alert('Gagal menyintesis bab: ' + e.message);
    } finally {
      setSynthesizingChapterId(null);
    }
  };

  const currentChapter = activeProject?.chapters.find((c) => c.id === activeChapterId);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Audiobook Projects & Chapters</h1>
          <TooltipInfo
            title="Multi-Chapter Audiobook Studio"
            text="Susun buku atau artikel panjang menjadi beberapa bab. Tiap bab dapat memilih narator dan aksen berbeda serta disimpan otomatis ke PC."
            position="right"
          />
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && activeProject && (
            <>
              <select
                value={activeProject.id}
                onChange={(e) => {
                  const found = projects.find((p) => p.id === e.target.value);
                  if (found) {
                    setActiveProject(found);
                    if (found.chapters[0]) setActiveChapterId(found.chapters[0].id);
                  }
                }}
                className="rounded-xl bg-dark-900 border border-white/10 px-3 py-2 text-xs font-semibold text-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    📚 {p.title} ({p.chapters.length} Bab)
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleSaveProject(activeProject)}
                disabled={isSaving}
                className="rounded-xl bg-dark-850 border border-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-dark-800"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </>
          )}

          <button
            onClick={handleCreateProject}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            Buku Baru
          </button>
        </div>
      </div>

      {/* Main Editor Grid */}
      {activeProject && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Chapters List */}
          <div className="lg:col-span-4 studio-card rounded-2xl p-4 space-y-3 h-fit">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Daftar Bab ({activeProject.chapters.length})
              </span>
              <button
                onClick={handleAddChapter}
                className="flex items-center gap-1 rounded-lg bg-purple-500/20 text-purple-300 px-2.5 py-1 text-xs font-bold hover:bg-purple-500/30"
              >
                <Plus className="h-3.5 w-3.5" />
                Bab
              </button>
            </div>

            <div className="space-y-2">
              {activeProject.chapters.map((chap, idx) => {
                const isSelected = chap.id === activeChapterId;
                return (
                  <div
                    key={chap.id}
                    onClick={() => setActiveChapterId(chap.id)}
                    className={`flex items-center justify-between rounded-xl p-3 cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-purple-950/50 border-purple-400 text-white'
                        : 'bg-dark-850/60 border-white/5 text-dark-200 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-purple-400">#{idx + 1}</span>
                        <h4 className="text-xs font-bold truncate">{chap.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-dark-300">
                        <span>{chap.content.length} kar</span>
                        {chap.audioUrl && (
                          <span className="text-emerald-400 flex items-center gap-0.5 font-semibold">
                            <Check className="h-3 w-3" /> Audio
                          </span>
                        )}
                      </div>
                    </div>

                    {activeProject.chapters.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveChapter(chap.id);
                        }}
                        className="text-dark-400 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Active Chapter Manuscript */}
          <div className="lg:col-span-8">
            {currentChapter && (
              <div className="studio-card rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="text"
                    value={currentChapter.title}
                    onChange={(e) =>
                      handleUpdateChapter(currentChapter.id, { title: e.target.value })
                    }
                    className="flex-1 rounded-xl bg-dark-850 border border-white/10 px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-purple-500"
                  />

                  <select
                    value={currentChapter.voiceId}
                    onChange={(e) =>
                      handleUpdateChapter(currentChapter.id, { voiceId: e.target.value })
                    }
                    className="rounded-xl bg-dark-850 border border-white/10 px-3 py-2 text-xs font-semibold text-white"
                  >
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        🎙️ {v.name} ({v.accent})
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={8}
                  value={currentChapter.content}
                  onChange={(e) =>
                    handleUpdateChapter(currentChapter.id, { content: e.target.value })
                  }
                  placeholder="Tulis atau tempel naskah bab buku audio di sini..."
                  className="w-full rounded-xl bg-dark-950/70 border border-white/10 p-4 text-base text-white leading-relaxed focus:outline-none focus:border-purple-500 resize-none"
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-dark-300 font-mono">
                    {currentChapter.content.length} kar
                  </span>

                  <button
                    onClick={() => handleSynthesizeChapter(currentChapter.id)}
                    disabled={
                      synthesizingChapterId === currentChapter.id ||
                      !currentChapter.content.trim()
                    }
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40"
                  >
                    <Wand2 className="h-4 w-4" />
                    {synthesizingChapterId === currentChapter.id
                      ? 'Menyintesis Bab...'
                      : 'Generate Audio Bab'}
                  </button>
                </div>

                {currentChapter.audioUrl && (
                  <div className="pt-3 border-t border-white/10">
                    <AudioWaveVisualizer
                      audioUrl={currentChapter.audioUrl}
                      duration={currentChapter.duration}
                      autoPlay
                      fileName={`${activeProject.title}-${currentChapter.title}.mp3`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
