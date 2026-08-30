import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { groqChat } from '@/lib/claude';

const FIELD_LABELS: Record<string, string> = {
  title: '제목',
  subtitle: '부제목',
  content: '본문',
  items: '항목',
  vocabulary: '어휘',
  passage: '지문',
  choices: '선택지',
  grammarQuestions: '문법 문제',
  oxQuestions: 'OX 문제',
  questions: '문제',
  mainQuestion: '주요 질문',
  subQuestions: '세부 질문',
};

function truncate(s: string, n = 50) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function describeChange(key: string, oldVal: unknown, newVal: unknown): string {
  const label = FIELD_LABELS[key] || key;
  if (typeof oldVal === 'string' && typeof newVal === 'string') {
    return `- ${label}: "${truncate(oldVal)}" → "${truncate(newVal)}"`;
  }
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return `- ${label}: 항목 ${oldVal.length}개 → ${newVal.length}개`;
  }
  return `- ${label} 수정됨`;
}

function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    const match = candidate.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { message, history } = await req.json();

    const slide = await prisma.slide.findUnique({ where: { id } });
    if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const slideData = JSON.parse(slide.data);

    const chatHistory = Array.isArray(history)
      ? history.slice(-10).map((m: { role: string; content: string }) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }))
      : [];

    const systemMsg = `당신은 한국 영어 수업 슬라이드 편집을 돕는 AI입니다. 현재 슬라이드 데이터: ${JSON.stringify(slideData)}

사용자의 메시지가 슬라이드 수정 요청이면, 다음 JSON 형식으로만 응답하세요 (다른 설명 없이 JSON만):
{"type":"edit","updates":{실제로 값이 바뀌는 필드만 포함한 부분 객체},"summary":"무엇을 어떻게 바꿨는지 한국어 한 문장 설명"}

사용자의 메시지가 질문이거나 수정 요청이 아니면 (예: "뭐가 바뀐거야?", "이게 무슨 뜻이야?", 이전 답변에 대한 되물음 등) 다음 형식으로만 응답하세요:
{"type":"answer","reply":"한국어로 대화 맥락을 반영한 답변"}

실제로 아무것도 바꿀 필요가 없다면 updates를 빈 객체 {}로 두세요.`;

    const text = await groqChat([...chatHistory, { role: 'user', content: message }], 2000, systemMsg);
    const parsed = extractJson(text);

    if (!parsed) {
      return NextResponse.json({
        reply: text || '죄송해요, 요청을 이해하지 못했어요. 다시 한번 말씀해 주시겠어요?',
      });
    }

    if (parsed.type === 'answer' || !parsed.updates) {
      return NextResponse.json({ reply: parsed.reply || '무엇을 도와드릴까요?' });
    }

    const updates = parsed.updates || {};
    const changedKeys = Object.keys(updates).filter(
      (k) => JSON.stringify((slideData as any)[k]) !== JSON.stringify(updates[k])
    );

    if (changedKeys.length === 0) {
      return NextResponse.json({
        reply:
          parsed.summary ||
          '요청하신 내용이 이미 반영되어 있어서 실제로 바뀐 부분이 없어요. 어떤 부분을 어떻게 바꾸고 싶은지 조금 더 구체적으로 알려주세요.',
      });
    }

    const newData = { ...slideData, ...updates };
    await prisma.slide.update({
      where: { id },
      data: { data: JSON.stringify(newData) },
    });

    const diffLines = changedKeys.map((k) => describeChange(k, (slideData as any)[k], updates[k]));
    const reply = [parsed.summary, ...diffLines].filter(Boolean).join('\n');

    return NextResponse.json({ reply, updatedData: newData });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
