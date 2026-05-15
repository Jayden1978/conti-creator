import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const slide = await prisma.slide.update({
      where: { id },
      data: { approved: body.approved },
    });

    return NextResponse.json(slide);
  } catch (error) {
    console.error('PATCH /api/slides/[id] error:', error);
    return NextResponse.json({ error: '슬라이드 업데이트에 실패했습니다.' }, { status: 500 });
  }
}
