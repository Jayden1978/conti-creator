import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSlides, generateVocabAndOXSlides, generateGrammarSlides, generateGrammarChainSlide, generateReadingActivitySlide, generateLineEnglishSlides } from '@/lib/claude';
import type { SlideItem } from '@/lib/types';

const isGrammarJudgePassage = (questionType: string | undefined) => /어법성|어법 판단|어법상/i.test(questionType || '');

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.analysis) return NextResponse.json({ error: 'No analysis' }, { status: 400 });

    await prisma.slide.deleteMany({ where: { projectId } });

    const isNaeshin = project.contiType === '내신대비용';
    const baseSlides = await generateSlides(project.analysis, [], project.contiType);
    for (const s of baseSlides) {
      if (s.type === 'cover') {
        s.data = { ...s.data, className: project.className || undefined, classDay: project.classDay || undefined };
      }
    }
    const passageSlides = baseSlides.filter(s => s.type === 'passage');

    let allSlides: SlideItem[];

    if (isNaeshin) {
      // 내신대비용: [표지] → 지문마다 [지문 → 단어정리 → 내용확인 → 내용확인정답 → 어법퀴즈 → 어법퀴즈정답] → [오늘 수업 되돌아보기]
      allSlides = [];

      // 표지 + 학습목표 슬라이드 (baseSlides에서 가져오기)
      const coverSlides = baseSlides.filter(s => ['cover', 'objectives'].includes(s.type));
      allSlides.push(...coverSlides);

      for (let i = 0; i < passageSlides.length; i++) {
        const ps = passageSlides[i];
        const passageText = ps.data.passage?.text ?? '';
        const passageTitle = ps.data.passage?.source ?? (ps.data.title ?? `Passage ${i + 1}`);

        allSlides.push(ps);

        allSlides.push(...generateLineEnglishSlides(passageText, passageTitle, i + 1));

        const vocabOX = await generateVocabAndOXSlides(passageText, passageTitle, i + 1);
        allSlides.push(...vocabOX.filter(s => s.type === 'vocabulary'));

        const readingActivity = await generateReadingActivitySlide(passageText, passageTitle, i + 1, true);
        allSlides.push(readingActivity);
        allSlides.push({
          id: `reading-answer-${i + 1}`, projectId: '', order: 0,
          type: 'reading-answer', layout: 'title-content',
          data: {
            title: `독해 정답 — Passage ${i + 1}`,
            subQuestions: readingActivity.data.subQuestions,
            answers: readingActivity.data.answers,
          },
          approved: false,
        });

        allSlides.push(...vocabOX.filter(s => s.type === 'ox-quiz' || s.type === 'ox-answer'));

        if (isGrammarJudgePassage(ps.data.passage?.questionType)) {
          const chain = await generateGrammarChainSlide(passageText, passageTitle, i + 1);
          if (chain) allSlides.push(chain);
        } else {
          const grammar = await generateGrammarSlides(passageText, passageTitle, i + 1, true);
          allSlides.push(...grammar);
        }
      }

      // 7. 오늘 수업 되돌아보기
      allSlides.push({
        id: 'micro-feedback-final', projectId: '', order: 0,
        type: 'micro-feedback', layout: 'title-content',
        data: {
          title: '오늘 수업 되돌아보기',
          items: [
            '오늘 배운 내용 중 가장 기억에 남는 것은?',
            '어려웠던 부분은 무엇인가요?',
            '이해도를 스스로 평가해보세요 (⭐~⭐⭐⭐⭐⭐)',
          ],
        },
        approved: false,
      });
    } else {
      // 정규수업용: 지문 슬라이드 사이사이에 단어/OX/어법 삽입
      allSlides = [];
      const nonPassageSlides = baseSlides.filter(s => s.type !== 'passage');

      // 커버/학습목표 등 앞 슬라이드
      const coverAndBefore = nonPassageSlides.filter(s =>
        ['cover', 'objectives'].includes(s.type)
      );
      allSlides.push(...coverAndBefore);

      for (let i = 0; i < passageSlides.length; i++) {
        const ps = passageSlides[i];
        const passageText = ps.data.passage?.text ?? '';
        const passageTitle = ps.data.passage?.source ?? (ps.data.title ?? `Passage ${i + 1}`);

        allSlides.push(ps);

        const vocabOX = await generateVocabAndOXSlides(passageText, passageTitle, i + 1);
        allSlides.push(...vocabOX);

        if (isGrammarJudgePassage(ps.data.passage?.questionType)) {
          const chain = await generateGrammarChainSlide(passageText, passageTitle, i + 1);
          if (chain) allSlides.push(chain);
        } else {
          const grammar = await generateGrammarSlides(passageText, passageTitle, i + 1);
          allSlides.push(...grammar);
        }
      }
    }

    await prisma.slide.createMany({
      data: allSlides.map((s, i) => ({
        projectId,
        order: i,
        type: s.type,
        layout: s.layout,
        data: JSON.stringify(s.data),
        approved: false,
      })),
    });

    await prisma.project.update({ where: { id: projectId }, data: { status: 'slides' } });

    const created = await prisma.slide.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ slides: created.map(s => ({ ...s, data: JSON.parse(s.data) })) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
