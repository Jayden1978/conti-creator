import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeLessonMaterial } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const files = formData.getAll('files') as File[];

    if (!projectId) {
      return NextResponse.json({ error: 'projectId가 필요합니다.' }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    // Convert files to base64
    const fileData = await Promise.all(
      files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const isPdf = file.type === 'application/pdf';
        return {
          type: isPdf ? 'pdf' as const : 'image' as const,
          base64,
          mediaType: file.type,
        };
      })
    );

    const analysis = await analyzeLessonMaterial(fileData);

    // Save analysis to project
    await prisma.project.update({
      where: { id: projectId },
      data: { analysis },
    });

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('POST /api/analyze error:', error);
    const message =
      error?.message?.includes('이미지 파일') ? error.message :
      error?.message?.includes('API key') || error?.status === 400 || error?.status === 401
        ? 'GROQ_API_KEY가 설정되지 않았거나 올바르지 않습니다. .env 파일을 확인해주세요.'
        : error?.message || '분석 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
