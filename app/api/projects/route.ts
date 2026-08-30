import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { slides: true } } },
    });
    return NextResponse.json(projects.map(p => ({
      id: p.id,
      name: p.name,
      subject: p.subject,
      grade: p.grade,
      topic: p.topic,
      contiType: p.contiType,
      status: p.status,
      slideCount: p._count.slides,
      createdAt: p.createdAt,
    })));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const project = await prisma.project.create({
      data: {
        name: body.name,
        subject: body.subject || '영어',
        grade: body.grade,
        topic: body.topic,
        contiType: body.contiType || '정규수업용',
        className: body.className || '',
        classDay: body.classDay || '',
        status: 'analyze',
      },
    });
    return NextResponse.json(project);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
