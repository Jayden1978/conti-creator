import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: { _count: { select: { slides: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      subject: p.subject,
      grade: p.grade,
      topic: p.topic,
      status: p.status,
      slideCount: p._count.slides,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: '프로젝트 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, subject, grade, topic, contiType, className, classDay } = body;

    if (!name || !grade || !topic) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        subject: subject || '영어',
        grade,
        topic,
        contiType: contiType || '정규수업용',
        className: className || '',
        classDay: classDay || '',
        status: 'analyze',
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: '프로젝트 생성에 실패했습니다.' }, { status: 500 });
  }
}
