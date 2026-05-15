import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { message, history } = await request.json();

    // 현재 슬라이드 데이터 가져오기
    const slide = await prisma.slide.findUnique({ where: { id } });
    if (!slide) return NextResponse.json({ error: '슬라이드를 찾을 수 없습니다.' }, { status: 404 });

    const currentData = typeof slide.data === 'string' ? JSON.parse(slide.data) : slide.data;

    const systemPrompt = `You are an AI assistant that helps Korean English teachers edit lesson slides.
Current slide info:
- Type: ${slide.type}
- Data: ${JSON.stringify(currentData, null, 2)}

When the user asks to modify the slide:
1. Understand their request (Korean or English)
2. Return a JSON response in this exact format:
{
  "reply": "변경 내용에 대한 한국어 설명",
  "updatedData": { ...updated slide data object... }
}

If no changes needed (just a question), return:
{
  "reply": "답변 내용",
  "updatedData": null
}

CRITICAL RULES:
- NEVER use HTML tags (no <font>, <b>, <span>, <div> etc.) — plain text only in all string fields
- "reply" must be in Korean
- Keep all existing fields unless specifically asked to change

Slide type rules:
- cover: { title, subtitle, content?, items?,
    subtitleColor?(hex or CSS color name), subtitleSize?(number, px),
    titleColor?(hex or CSS color name), titleSize?(number, px) }
  → 글자색 변경: subtitleColor / titleColor 필드에 hex값(예:"#FFD700") 또는 색상명(예:"yellow") 사용
  → 글자 크기 변경: subtitleSize / titleSize 필드에 숫자(px) 사용 (기본: subtitle=13, title=48)
  → 제목 아래 추가 내용: content(한 줄) 또는 items(목록 배열)
- vocabulary: vocabulary array with {word, meaning, example}
- passage: passage object with {text, source}
- ox-quiz/ox-answer: oxQuestions array
- objectives/summary/feedback/micro-feedback/assignment-feedback/common-qa: items array (+ optional content 필드)
- grammar-quiz/grammar-answer: grammarQuestions array
- Always return valid JSON only`;

    // 대화 히스토리 구성
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages,
      max_tokens: 3000,
    });

    const text = response.choices[0].message.content || '';

    // JSON 파싱
    let parsed: { reply: string; updatedData: any } = { reply: text, updatedData: null };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = { reply: text, updatedData: null };
    }

    // 변경사항이 있으면 DB 업데이트
    if (parsed.updatedData && typeof parsed.updatedData === 'object') {
      await prisma.slide.update({
        where: { id },
        data: { data: JSON.stringify(parsed.updatedData) },
      });
    }

    return NextResponse.json({
      reply: parsed.reply || '처리되었습니다.',
      updatedData: parsed.updatedData,
    });
  } catch (error) {
    console.error('POST /api/slides/[id]/chat error:', error);
    return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
