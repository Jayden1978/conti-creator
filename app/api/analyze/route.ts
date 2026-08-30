import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeLessonMaterial, analyzeTextContent } from '@/lib/claude';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, content, files } = body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    let analysis: string;
    if (files && files.length > 0) {
      analysis = await analyzeLessonMaterial(files);
    } else if (content) {
      analysis = await analyzeTextContent(content);
    } else {
      return NextResponse.json({ error: '파일 또는 텍스트를 입력해주세요.' }, { status: 400 });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { analysis, status: 'slides' },
    });

    return NextResponse.json({ analysis });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
