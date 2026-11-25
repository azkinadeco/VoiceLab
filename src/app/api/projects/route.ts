import { NextRequest, NextResponse } from 'next/server';
import {
  getProjects,
  saveProject,
  deleteProject,
  getAllVoices,
  saveAudioFile,
  addGeneration,
  getAppSettings,
  applyPronunciationDictionary,
} from '@/lib/storage';
import { synthesizeSpeech } from '@/lib/tts-engine';
import { AudiobookProject, Generation } from '@/lib/types';

export async function GET() {
  try {
    const projects = getProjects();
    return NextResponse.json({ projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If action is synthesize_chapter
    if (body.action === 'synthesize_chapter') {
      const { projectId, chapterId } = body;
      const projects = getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      const chapter = project.chapters.find((c) => c.id === chapterId);
      if (!chapter || !chapter.content.trim()) {
        return NextResponse.json({ error: 'Chapter content is empty' }, { status: 400 });
      }

      const voices = getAllVoices();
      const voice =
        voices.find((v) => v.id === (chapter.voiceId || project.defaultVoiceId)) || voices[0];
      const appSettings = getAppSettings();
      const processed = applyPronunciationDictionary(chapter.content.trim());

      const { buffer, duration, format } = await synthesizeSpeech(
        processed,
        voice.voiceIdEdge,
        {
          speed: 1.0,
          pitch: 0,
          stability: 80,
          similarity: 85,
          styleExaggeration: 0,
          speakerBoost: true,
        },
        appSettings
      );

      const fileName = `proj-${project.id}-${chapter.id}-${Date.now()}.${format}`;
      const { relativeUrl } = await saveAudioFile(buffer, 'projects', fileName);

      chapter.audioUrl = relativeUrl;
      chapter.duration = duration;
      chapter.status = 'completed';

      const savedProj = saveProject(project);

      const newGen: Generation = {
        id: `projgen-${Date.now()}`,
        text: `[${project.title} - ${chapter.title}] ${chapter.content.trim().slice(0, 180)}`,
        voiceId: voice.id,
        voiceName: voice.name,
        voiceAvatar: voice.avatarUrl,
        audioUrl: relativeUrl,
        duration,
        createdAt: new Date().toISOString(),
        model: 'Audiobook Long-Form Engine v2',
        type: 'project',
        fileSize: buffer.length,
        starred: false,
        settings: {
          speed: 1.0,
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
        project: savedProj,
        chapter,
        generation: newGen,
      });
    }

    // Create or update project
    const project: AudiobookProject = {
      id: body.id || `proj-${Date.now()}`,
      title: body.title || 'Untitled Audiobook',
      author: body.author || 'Author',
      description: body.description || '',
      defaultVoiceId: body.defaultVoiceId || 'voice-ardi',
      chapters: body.chapters || [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = saveProject(project);
    return NextResponse.json({ success: true, project: saved });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing project id' }, { status: 400 });
    }
    const success = deleteProject(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
