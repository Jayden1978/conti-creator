import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSlides, generateVocabAndOXSlides, generateGrammarSlides } from '@/lib/claude';
import type { SlideItem } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, analysis, files } = body;

    if (!projectId || !analysis) {
      return NextResponse.json({ error: 'projectId와 analysis가 필요합니다.' }, { status: 400 });
    }

    // 프로젝트 정보 조회 (이름, 학년, 주제)
    const project = await prisma.project.findUnique({ where: { id: projectId } });

    // ① 메인 슬라이드 생성 (cover, feedback, objectives, passage×N, summary, micro-feedback)
    //    vocab/OX는 포함하지 않음 → 토큰 절약
    const contiType = (project as any)?.contiType || '정규수업용';
    const mainSlides = await generateSlides(analysis, files || [], contiType);

    // 커버 슬라이드에 프로젝트 정보 강제 반영
    if (project) {
      const coverSlide = mainSlides.find((s) => s.type === 'cover');
      if (coverSlide) {
        const meta: string[] = [];
        if ((project as any).className) meta.push((project as any).className);
        if ((project as any).classDay) meta.push((project as any).classDay);
        coverSlide.data = {
          ...coverSlide.data,
          title: project.name,
          subtitle: `${project.grade} · ${project.topic}`,
          className: (project as any).className || '',
          classDay: (project as any).classDay || '',
          meta: meta.join(' | '),
        };
      }
    }

    // ② passage 슬라이드마다: vocab+OX (별도 호출) → grammar (별도 호출) 순으로 삽입
    const finalSlides: SlideItem[] = [];
    let passageCount = 0;

    for (let i = 0; i < mainSlides.length; i++) {
      const slide = mainSlides[i];
      finalSlides.push(slide);

      if (slide.type === 'passage') {
        passageCount++;
        const passageText = slide.data.passage?.text || (slide.data as any).text || '';
        const passageTitle = String(slide.data.title || `Passage ${passageCount}`);

        if (passageText) {
          // 어휘 + OX 퀴즈/답 생성 (passage 바로 뒤) — 내신대비도 포함
          const vocabOXSlides = await generateVocabAndOXSlides(passageText, passageTitle, passageCount);
          finalSlides.push(...vocabOXSlides);

          // 어법 퀴즈/답 생성 (OX 답 뒤) — 내신대비도 포함
          const grammarSlides = await generateGrammarSlides(passageText, passageTitle, passageCount);
          finalSlides.push(...grammarSlides);
        }
      }
    }

    // ③ order 재부여
    finalSlides.forEach((s, i) => { s.order = i + 1; });

    // ④ 기존 슬라이드 삭제 후 저장
    await prisma.slide.deleteMany({ where: { projectId } });

    const savedSlides = await Promise.all(
      finalSlides.map((slide) =>
        prisma.slide.create({
          data: {
            projectId,
            order: slide.order,
            type: slide.type,
            layout: slide.layout,
            data: JSON.stringify(slide.data),
            approved: false,
          },
        })
      )
    );

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'slides' },
    });

    return NextResponse.json({ slides: savedSlides });
  } catch (error: any) {
    console.error('POST /api/generate-slides error:', error);
    const msg = error?.message || '슬라이드 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
