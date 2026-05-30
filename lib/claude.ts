import Groq from 'groq-sdk';
import type { SlideItem } from './types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/** PDF base64 → 텍스트 추출 */
async function extractPdfText(base64: string): Promise<string> {
  // Node.js에서 없는 브라우저 API 폴리필
  const g = globalThis as any;
  if (!g.DOMMatrix) g.DOMMatrix = class { constructor() {} };
  if (!g.DOMPoint) g.DOMPoint = class { constructor() {} };
  if (!g.DOMRect) g.DOMRect = class { constructor() {} };
  if (!g.Path2D) g.Path2D = class { constructor() {} };
  if (!g.ImageData) g.ImageData = class { constructor() {} };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const buffer = Buffer.from(base64, 'base64');
  const data = await pdfParse(buffer);
  return data.text || '';
}

const ANALYSIS_PROMPT = `You are analyzing English lesson material for a Korean English teacher.

==== ABSOLUTE RULES — NEVER VIOLATE ====
1. NEVER change the question type. Identify EXACTLY what type of question it is from the original.
2. Copy ALL reading passages WORD FOR WORD, CHARACTER FOR CHARACTER, exactly as they appear.
3. ①②③④⑤ markers INSIDE passage text (어법성판단): MUST be preserved in the passage text — do NOT move them to choices, do NOT delete them.
4. ____ blanks (빈칸추론): MUST be preserved exactly as written.
5. (A)(B)(C) sections (글의순서): MUST be preserved in the passage text.
6. NEVER paraphrase, summarize, or rewrite any part of the passage.
===========================================

HOW TO IDENTIFY QUESTION TYPE — READ THE QUESTION CAREFULLY:

COMPREHENSION TYPES (5 Korean/English phrase choices):
- 목적: "다음 글의 목적으로 가장 적절한 것은?" — writer's purpose
- 심경: "다음 글에 드러난 심경/심경 변화로 가장 적절한 것은?" — mood or mood change
- 주장: "다음 글에서 필자가 주장하는 바로 가장 적절한 것은?" — writer's argument/claim
- 함의: "밑줄 친 [표현]이 다음 글에서 의미하는 바로 가장 적절한 것은?" — implied meaning of underlined expression
- 요지: "다음 글의 요지로 가장 적절한 것은?" — main point
- 주제: "다음 글의 주제로 가장 적절한 것은?" — topic/subject
- 제목: "다음 글의 제목으로 가장 적절한 것은?" — title
- 지칭: "밑줄 친 (a)~(e) 중에서 가리키는 대상이 나머지 넷과 다른 것은?" — referent identification

LANGUAGE TYPES:
- 어법성판단: "밑줄 친 부분 중, 어법상 틀린 것은?" — GRAMMAR errors; ①②③④⑤ inline in passage marking words/phrases
- 어휘 적절성: "밑줄 친 낱말 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?" — VOCABULARY wrong in context; ①②③④⑤ inline marking individual words
  *** CRITICAL: vocabulary question → "어휘 적절성" / grammar question → "어법성 판단". DIFFERENT types even though both use ①②③④⑤ inline. ***
- 알맞은표현(어법): "(A)(B)(C) 각 네모에서 어법에 맞는 표현" with [word1/word2] choices in text

STRUCTURE TYPES:
- 빈칸추론: passage has ____ blank(s); choices are words/phrases to fill in the blank
- 글의순서: "주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?" — arrange (A)(B)(C) paragraphs; choices like "(A)-(C)-(B)"
  *** CRITICAL: If choices are word/phrase pairs like "① In addition — However" or "① certain — eliminate" → this is NOT 글의순서. It is 빈칸추론 with two blanks (A)(B). ***
- 흐름과무관한문장: "전체 흐름과 관계 없는 문장은?" — ①②③④⑤ at START of sentences, find the irrelevant one
- 문장삽입: "주어진 문장이 들어가기에 가장 적절한 곳은?" — ①②③④⑤ mark INSERTION POINTS between sentences; a separate "given sentence" must be noted
- 요약문완성: "다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로..." — passage + summary sentence with TWO blanks (A) and (B); choices are word pairs like "① (A)certain — (B)eliminate"

Please extract and provide:

1. Grade/Level
2. Learning Objectives (3-5 items)
3. Complete Vocabulary List — MINIMUM 12 words per passage, ALL important words, verbs, adjectives, nouns, phrases, collocations:
   Format: word / 한국어뜻 / English example sentence
4. For EACH passage:
   === PASSAGE [N]: [question number] — [question type] ===

   PASSAGE TEXT (copy EXACTLY, do NOT change anything):
   [For 어법성판단: copy every character including the ①②③④⑤ markers exactly where they appear in the text]
   [For 빈칸추론: keep ____ exactly]
   [For 글의순서: keep (A)(B)(C) structure]

   CHOICES (copy EXACTLY from original):
   [For 어법성판단 / 어휘 적절성: "① ② ③ ④ ⑤" — these circle numbers ARE the answer choices]
   [For 알맞은표현(어법): table with (A)(B)(C) columns. Copy each row: "① [A] - [B] - [C]", "② ...", etc. NEVER use JSON objects.]
   [For 문장삽입: copy the GIVEN SENTENCE as a special note, then choices are "① ② ③ ④ ⑤"]
   [For 요약문완성: copy all 5 word-pair choices verbatim, e.g. "① (A)certain — (B)eliminate"]
   [For others: copy all 5 choices ①②③④⑤ verbatim]

   UNDERLINED TEXT: [exact phrase underlined in the original — required for 함의 type]
   GIVEN SENTENCE: [for 문장삽입 only — copy the sentence that needs to be inserted]
5. Grammar Points
6. Exercise Types`;



export async function analyzeLessonMaterial(
  files: { type: 'image' | 'pdf'; base64: string; mediaType: string }[]
): Promise<string> {
  const imageFiles = files.filter((f) => f.type === 'image');
  const pdfFiles  = files.filter((f) => f.type === 'pdf');

  if (imageFiles.length === 0 && pdfFiles.length === 0) {
    throw new Error('파일을 업로드해주세요. JPG, PNG, PDF 형식을 지원합니다.');
  }

  /* ── PDF 처리: 텍스트 추출 후 텍스트 전용 분석 ── */
  if (pdfFiles.length > 0 && imageFiles.length === 0) {
    const texts: string[] = [];
    for (const f of pdfFiles) {
      const t = await extractPdfText(f.base64);
      if (t.trim()) texts.push(t.trim());
    }
    if (texts.length === 0) {
      throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF는 JPG/PNG로 변환 후 업로드해주세요.');
    }

    const combined = texts.join('\n\n--- 다음 파일 ---\n\n');
    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting content from English lesson materials. Your most critical job is to copy ALL reading passages EXACTLY as written. Never summarize.',
        },
        {
          role: 'user',
          content: `${ANALYSIS_PROMPT}\n\n--- PDF 추출 텍스트 ---\n${combined}`,
        },
      ],
      max_tokens: 6000,
    });
    return response.choices[0].message.content || '';
  }

  /* ── 이미지 처리 (PDF 혼합 포함) ── */
  const content: Groq.Chat.ChatCompletionContentPart[] = [];

  // PDF가 함께 있으면 텍스트로 추가
  if (pdfFiles.length > 0) {
    const texts: string[] = [];
    for (const f of pdfFiles) {
      try {
        const t = await extractPdfText(f.base64);
        if (t.trim()) texts.push(t.trim());
      } catch { /* 스캔 PDF면 무시하고 이미지로 처리 */ }
    }
    if (texts.length > 0) {
      content.push({
        type: 'text',
        text: `Additional text from PDF:\n${texts.join('\n\n')}`,
      });
    }
  }

  for (const file of imageFiles.slice(0, 6)) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${file.mediaType};base64,${file.base64}` },
    });
  }

  content.push({ type: 'text', text: ANALYSIS_PROMPT });

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at extracting content from English lesson material images and text. Copy ALL reading passages EXACTLY as written. Never summarize.',
      },
      { role: 'user', content },
    ],
    max_tokens: 6000,
  });

  return response.choices[0].message.content || '';
}

// ── 내신대비용: 지문 텍스트만 추출하여 passage 슬라이드 생성 ──
async function generateNaeshinSlides(
  analysis: string,
  files: { type: 'image' | 'pdf'; base64: string; mediaType: string }[]
): Promise<SlideItem[]> {
  const imageFiles = files.filter((f) => f.type === 'image');
  const content: Groq.Chat.ChatCompletionContentPart[] = [];

  for (const file of imageFiles.slice(0, 6)) {
    content.push({ type: 'image_url', image_url: { url: `data:${file.mediaType};base64,${file.base64}` } });
  }

  // AI는 cover, objectives, passage만 생성 — 나머지는 코드에서 직접 삽입
  content.push({
    type: 'text',
    text: `Here is the analyzed lesson material:
===
${analysis}
===

Extract passage texts for a 내신대비(exam prep) lesson. Return ONLY valid JSON.

RULES:
- Extract ONLY the passage text. Copy WORD FOR WORD.
- Remove ①②③④⑤ circle numbers from passage text.
- Remove ____ blanks (fill with the correct word if known, otherwise remove).
- Remove (A)(B)(C) labels and merge into one continuous paragraph.
- NO question types, NO choices, NO annotations.

Return this exact JSON:
{
  "title": "Lesson title (e.g. 1학기 기말고사 대비)",
  "subtitle": "Grade/Unit (e.g. 고2 · 모의고사)",
  "objectives": ["~을 이해할 수 있다.", "~을 설명할 수 있다.", "~을 파악할 수 있다."],
  "passages": [
    { "title": "PASSAGE 1", "text": "Full clean passage text here." },
    { "title": "PASSAGE 2", "text": "Full clean passage text here." }
  ]
}`,
  });

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: 'Extract passage texts exactly as written. Return ONLY valid JSON.' },
      { role: 'user', content },
    ],
    max_tokens: 8000,
  });

  const text = response.choices[0].message.content || '';
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1];
  else { const i = text.indexOf('{'); if (i >= 0) jsonStr = text.slice(i); }

  let parsed: any;
  try { parsed = JSON.parse(jsonStr); } catch {
    try {
      let s = jsonStr.replace(/,\s*$/, '');
      let b = 0, br = 0, inStr = false, esc = false;
      for (const c of s) {
        if (esc) { esc = false; continue; }
        if (c === '\\' && inStr) { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (!inStr) { if (c==='{') b++; else if (c==='}') b--; else if (c==='[') br++; else if (c===']') br--; }
      }
      for (let i=0;i<br;i++) s+=']'; for (let i=0;i<b;i++) s+='}';
      parsed = JSON.parse(s);
    } catch { throw new Error('내신대비 슬라이드 생성 실패: JSON 파싱 오류'); }
  }

  if (!parsed?.passages) throw new Error('내신대비 슬라이드 생성 실패');

  // 고정 슬라이드 + AI 추출 지문 조합
  const slides: SlideItem[] = [];
  let idx = 0;
  const mk = (type: SlideItem['type'], data: any): SlideItem => ({
    id: `slide-${idx}`, projectId: '', order: ++idx, type, layout: 'title-content', data, approved: false,
  });

  slides.push(mk('cover', { title: parsed.title || '내신대비 콘티', subtitle: parsed.subtitle || '' }));
  slides.push(mk('feedback', { title: 'Micro Feedback', items: ['지난 시간에 배운 내용을 떠올려보세요.', '기억에 남는 단어나 표현이 있나요?', '오늘 수업에서 기대하는 것은 무엇인가요?'] }));
  slides.push(mk('assignment-feedback', { title: '과제 피드백', items: ['지난 과제에서 많이 틀린 문제 유형은?', '어려웠던 어휘나 표현을 다시 확인해봅시다.', '모범 답안과 자신의 답을 비교해보세요.'] }));
  slides.push(mk('common-qa', { title: '공통질문 풀이', items: ['지문에서 어려운 어휘가 있었나요?', '주제문을 찾는 방법이 궁금한 학생?'] }));
  slides.push(mk('objectives', { title: '학습 목표', items: parsed.objectives || ['지문을 정확히 이해할 수 있다.', '핵심 어휘를 파악할 수 있다.', '글의 흐름을 파악할 수 있다.'] }));

  for (const p of (parsed.passages || [])) {
    slides.push(mk('passage', {
      title: p.title || `PASSAGE ${idx}`,
      passage: { text: p.text || '', questionNumber: null, questionType: '', underlinedText: '' },
      choices: [],
    }));
  }

  slides.push(mk('summary', { title: '오늘 배운 내용 정리', items: ['오늘 학습한 지문의 핵심 내용을 정리해봅시다.', '새로 배운 어휘와 표현을 복습합니다.'] }));
  slides.push(mk('micro-feedback', { title: '오늘 수업 되돌아보기', items: ['오늘 배운 내용 중 기억에 남는 것은?', '어려웠던 부분은 무엇인가요?', '이해도를 스스로 평가해보세요 (⭐~⭐⭐⭐⭐⭐)'] }));

  return slides;
}

// 타이틀 기반 타입 추론 (AI가 type 필드를 빠뜨릴 때 대비)
function inferType(s: any): SlideItem['type'] {
  const t = String(s.type || '').toLowerCase().trim();
  const title = String(s.title || s.data?.title || '').toLowerCase();

  // type 필드가 유효한 값이면 그대로 사용
  const valid = ['cover','feedback','assignment-feedback','common-qa','objectives','vocabulary','passage','grammar','exercise','ox-quiz','ox-answer','grammar-quiz','grammar-answer','summary','micro-feedback'];
  if (valid.includes(t)) return t as SlideItem['type'];

  // type 필드가 없거나 'custom'이면 title로 추론
  if (title.includes('과제 피드백') || title.includes('assignment') || title.includes('숙제')) return 'assignment-feedback';
  if (title.includes('공통질문') || title.includes('common') || title.includes('질문 풀이')) return 'common-qa';
  if (title.includes('feedback') || title.includes('지난') || title.includes('warm') || title.includes('복습')) return 'feedback';
  if (title.includes('passage') || title.includes('지문') || title.includes('reading')) return 'passage';
  if (title.includes('어휘') || title.includes('vocabulary') || title.includes('vocab')) return 'vocabulary';
  if (title.includes('어법') && (title.includes('정답') || title.includes('answer'))) return 'grammar-answer';
  if (title.includes('어법') || title.includes('grammar quiz') || title.includes('어법 퀴즈')) return 'grammar-quiz';
  if (title.includes('정답') || title.includes('ox-answer') || title.includes('answer')) return 'ox-answer';
  if (title.includes('o/x') || title.includes('ox') || title.includes('내용 확인') || title.includes('퀴즈')) return 'ox-quiz';
  if (title.includes('학습 목표') || title.includes('objectives') || title.includes('목표')) return 'objectives';
  if (title.includes('정리') || title.includes('summary')) return 'summary';
  if (title.includes('되돌아보기') || title.includes('reflection')) return 'micro-feedback';
  if (title.includes('grammar') || title.includes('문법')) return 'grammar';
  if (title.includes('cover') || title.includes('단원') || title.includes('unit')) return 'cover';

  return 'custom';
}

// ── 선택지 파싱: 줄바꿈 또는 인라인(①②③④⑤ 구분) 모두 처리 ──
function splitChoices(raw: string): string[] {
  const circleNums = ['①','②','③','④','⑤'];
  // 줄 단위로 먼저 시도
  const byLine = raw.split('\n').map(l => l.trim()).filter(l => /^[①②③④⑤]/.test(l));
  if (byLine.length >= 2) return byLine.slice(0, 5);
  // 인라인: ①...②...③...④...⑤... 패턴 분리
  const inline = raw.replace(/\n/g, ' ');
  const parts = inline.split(/(?=[②③④⑤])/);
  if (parts.length >= 2) {
    return parts.map(p => p.trim()).filter(p => /^[①②③④⑤]/.test(p)).slice(0, 5);
  }
  // 첫 번째 ①로 시작하는 전체를 인라인으로 분리
  const fromFirst = inline.slice(inline.search(/[①②③④⑤]/));
  if (fromFirst) {
    const result: string[] = [];
    let cur = '';
    for (let i = 0; i < fromFirst.length; i++) {
      if (circleNums.includes(fromFirst[i]) && cur) {
        result.push(cur.trim());
        cur = fromFirst[i];
      } else {
        cur += fromFirst[i];
      }
    }
    if (cur) result.push(cur.trim());
    return result.slice(0, 5);
  }
  return byLine.slice(0, 5);
}

// ── 분석 텍스트에서 지문 파싱 (토큰 절약) ──
function parsePassagesFromAnalysis(analysis: string): Array<{
  questionNumber: number | null;
  questionType: string;
  text: string;
  choices: string[];
  underlinedText: string;
  givenSentence: string;
}> {
  const passages: ReturnType<typeof parsePassagesFromAnalysis> = [];

  // 다양한 PASSAGE 구분자 패턴 시도
  const splitPatterns = [
    /={2,}\s*PASSAGE\s*\d+\s*:/gi,           // === PASSAGE 1:
    /#{1,3}\s*PASSAGE\s*\d+\s*:/gi,           // ### PASSAGE 1:
    /PASSAGE\s*\[\d+\]\s*:/gi,                // PASSAGE [1]:
    /\n\s*PASSAGE\s*\d+\s*:/gi,               // \nPASSAGE 1:
    /\n\s*={2,}\s*PASSAGE\s*\d+/gi,           // \n=== PASSAGE 1
  ];

  let blocks: string[] = [];
  for (const pattern of splitPatterns) {
    const parts = analysis.split(pattern);
    if (parts.length > 1) { blocks = parts.slice(1); break; }
  }

  // 패턴으로 못 찾으면 PASSAGE TEXT 섹션을 직접 찾기
  if (blocks.length === 0) {
    const passageTextMatches = [...analysis.matchAll(/PASSAGE TEXT[^:]*:\s*([\s\S]*?)(?=CHOICES|={3,}|#{2,}|$)/gi)];
    const choicesMatches = [...analysis.matchAll(/CHOICES[^:]*:\s*([\s\S]*?)(?=UNDERLINED|GIVEN|={3,}|#{2,}|$)/gi)];
    for (let i = 0; i < passageTextMatches.length; i++) {
      const rawText = passageTextMatches[i][1].trim();
      const choicesRaw = choicesMatches[i]?.[1] || '';
      const choices = splitChoices(choicesRaw);
      if (rawText) {
        passages.push({ questionNumber: null, questionType: '', text: rawText, choices, underlinedText: '', givenSentence: '' });
      }
    }
    return passages;
  }

  for (const block of blocks) {
    // 헤더에서 문제번호, 유형 추출
    const header = block.match(/^([^\n]{0,80})/)?.[1] || '';
    const qNumMatch = header.match(/(\d{2})/);
    const qNum = qNumMatch ? parseInt(qNumMatch[1]) : null;
    const qTypeMatch = header.match(/[—\-–]\s*(.+)/);
    const qType = qTypeMatch ? qTypeMatch[1].replace(/={1,}/g, '').trim() : '';

    // PASSAGE TEXT 섹션 추출
    const textMatch = block.match(/PASSAGE TEXT[^:]*:\s*([\s\S]*?)(?=CHOICES|UNDERLINED TEXT|GIVEN SENTENCE|={3,}|#{2,}|$)/i);
    const rawText = textMatch ? textMatch[1].trim() : '';

    // CHOICES 섹션 추출
    const choicesMatch = block.match(/CHOICES[^:]*:\s*([\s\S]*?)(?=UNDERLINED TEXT|GIVEN SENTENCE|={3,}|#{2,}|$)/i);
    const choicesRaw = choicesMatch ? choicesMatch[1].trim() : '';
    const choices = splitChoices(choicesRaw);

    // UNDERLINED TEXT 추출
    const underlinedMatch = block.match(/UNDERLINED TEXT:\s*([^\n]*)/i);
    const underlinedText = underlinedMatch ? underlinedMatch[1].trim().replace(/^\[|\]$/g, '') : '';

    // GIVEN SENTENCE 추출 (문장삽입)
    const givenMatch = block.match(/GIVEN SENTENCE:\s*([^\n]*)/i);
    const givenSentence = givenMatch ? givenMatch[1].trim().replace(/^\[|\]$/g, '') : '';

    if (rawText) {
      passages.push({ questionNumber: qNum, questionType: qType, text: rawText, choices, underlinedText, givenSentence });
    }
  }
  return passages;
}

export async function generateSlides(
  analysis: string,
  files: { type: 'image' | 'pdf'; base64: string; mediaType: string }[],
  contiType: string = '정규수업용'
): Promise<SlideItem[]> {
  // ── 내신대비용: 지문 텍스트만 추출, 문제유형/선택지 없음 ──
  if (contiType === '내신대비용') {
    return generateNaeshinSlides(analysis, files);
  }

  // ── 정규수업용: 지문은 분석 텍스트에서 파싱, AI는 커버/학습목표만 생성 ──
  const parsedPassages = parsePassagesFromAnalysis(analysis);

  // AI에게 커버 제목/학습목표만 요청 (토큰 절약)
  const metaResponse = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: 'Return ONLY valid JSON, no markdown.' },
      { role: 'user', content: `Based on this English lesson analysis, return ONLY this JSON:
{
  "title": "수업 제목 (Korean, e.g. 모의고사 대비)",
  "subtitle": "학년 · 단원 (e.g. 고2 · 모의고사 3월)",
  "objectives": ["~을/를 이해할 수 있다.", "~을/를 설명할 수 있다.", "~을/를 파악할 수 있다.", "~을/를 적용할 수 있다."]
}

Analysis summary (first 800 chars):
${analysis.slice(0, 800)}` },
    ],
    max_tokens: 400,
  });

  // 메타 정보 파싱
  const metaText = metaResponse.choices[0].message.content || '';
  let meta: any = { title: '영어 수업', subtitle: '', objectives: [] };
  try {
    const mi = metaText.indexOf('{');
    if (mi >= 0) meta = JSON.parse(metaText.slice(mi));
  } catch { /* 기본값 사용 */ }

  // ── 슬라이드 조립 (AI 없이) ──
  let idx = 0;
  const mk = (type: SlideItem['type'], data: any): SlideItem => ({
    id: `slide-${idx}`, projectId: '', order: ++idx, type, layout: 'title-content', data, approved: false,
  });

  const slides: SlideItem[] = [];
  slides.push(mk('cover', { title: meta.title || '영어 수업', subtitle: meta.subtitle || '' }));
  slides.push(mk('feedback', { title: 'Micro Feedback', items: ['지난 시간에 배운 내용을 떠올려보세요.', '기억에 남는 단어나 표현이 있나요?', '오늘 수업에서 기대하는 것은 무엇인가요?'] }));
  slides.push(mk('assignment-feedback', { title: '과제 피드백', items: ['지난 과제에서 많이 틀린 문제 유형은 무엇이었나요?', '어려웠던 어휘나 표현을 다시 확인해봅시다.', '모범 답안과 자신의 답을 비교해보세요.'] }));
  slides.push(mk('common-qa', { title: '공통질문 풀이', items: ['이 지문에서 가장 어려운 문법 포인트는?', '주제문을 찾는 방법에 대해 질문이 있나요?', '어휘 중 뜻이 헷갈리는 단어가 있었나요?'] }));
  slides.push(mk('objectives', { title: '학습 목표', items: meta.objectives?.length ? meta.objectives : ['지문을 정확히 이해할 수 있다.', '핵심 어휘를 파악할 수 있다.', '글의 논리적 흐름을 파악할 수 있다.'] }));

  for (const p of parsedPassages) {
    const qLabel = p.questionNumber ? `${p.questionNumber}번` : 'PASSAGE';
    const typeLabel = p.questionType ? ` — ${p.questionType}` : '';
    // 문장삽입: givenSentence를 underlinedText로
    const underlined = p.givenSentence || p.underlinedText;
    slides.push(mk('passage', {
      title: `${qLabel}${typeLabel}`,
      passage: { text: p.text, questionNumber: p.questionNumber, questionType: p.questionType, underlinedText: underlined },
      choices: p.choices,
    }));
  }

  slides.push(mk('summary', { title: '오늘 배운 내용 정리', items: ['오늘 학습한 지문의 핵심 내용을 정리해봅시다.', '새로 배운 어휘와 표현을 복습합니다.', '문제 유형별 풀이 전략을 확인합시다.'] }));
  slides.push(mk('micro-feedback', { title: '오늘 수업 되돌아보기', items: ['오늘 배운 내용 중 기억에 남는 것은?', '어려웠던 부분은 무엇인가요?', '이해도를 스스로 평가해보세요 (⭐~⭐⭐⭐⭐⭐)'] }));

  // 파싱된 지문이 없으면 에러
  if (parsedPassages.length === 0) {
    throw new Error('지문을 찾을 수 없습니다. 분석을 다시 시도해주세요.');
  }

  return slides;
}


/** 지문 1개에 대한 어휘 + OX 퀴즈/답 슬라이드 생성 */
export async function generateVocabAndOXSlides(
  passageText: string,
  passageTitle: string,
  passageIndex: number
): Promise<SlideItem[]> {
  const suffix = `— Passage ${passageIndex}`;
  const prompt = `You are creating vocabulary and comprehension quiz slides for a Korean English class.

PASSAGE (${passageTitle}):
${passageText}

Return ONLY valid JSON (no markdown):
{
  "vocabulary": [
    { "word": "word", "meaning": "한국어뜻", "example": "English example sentence" }
  ],
  "oxQuestions": [
    { "number": 1, "statement": "한국어 문장", "answer": "O", "explanation": "한국어 해설" }
  ]
}

RULES:
- vocabulary: EXACTLY 12 words — nouns, verbs, adjectives, collocations from the passage — meaning in KOREAN, example in ENGLISH
- oxQuestions: EXACTLY 5 questions in Korean — based on passage content — mix O and X answers — include explanation for each`;

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: 'You are a Korean English teacher assistant. Return ONLY valid JSON. No markdown, no extra text.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 3000,
  });

  const text = response.choices[0].message.content || '';
  let jsonStr = text;
  const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) jsonStr = cb[1];
  else { const m = text.match(/\{[\s\S]*\}/); if (m) jsonStr = m[0]; }

  let vocabData: any = {};
  try { vocabData = JSON.parse(jsonStr); } catch { return []; }

  const vocabulary = vocabData.vocabulary || [];
  const oxQuestions = vocabData.oxQuestions || [];
  if (vocabulary.length === 0 && oxQuestions.length === 0) return [];

  const slides: SlideItem[] = [];

  if (vocabulary.length > 0) {
    slides.push({
      id: `vocabulary-${passageIndex}`,
      projectId: '',
      order: 0,
      type: 'vocabulary',
      layout: 'title-content',
      data: { title: `주요 어휘 ${suffix}`, vocabulary },
      approved: false,
    });
  }

  if (oxQuestions.length > 0) {
    const quizQuestions = oxQuestions.map(({ answer: _a, explanation: _e, ...q }: any) => q);
    slides.push({
      id: `ox-quiz-${passageIndex}`,
      projectId: '',
      order: 0,
      type: 'ox-quiz',
      layout: 'title-content',
      data: { title: `내용 확인 (O/X) ${suffix}`, oxQuestions: quizQuestions },
      approved: false,
    });
    slides.push({
      id: `ox-answer-${passageIndex}`,
      projectId: '',
      order: 0,
      type: 'ox-answer',
      layout: 'title-content',
      data: { title: `정답 확인 ${suffix}`, oxQuestions },
      approved: false,
    });
  }

  return slides;
}

/** 지문 1개에 대한 어법 퀴즈 슬라이드 생성 (grammar-quiz + grammar-answer) */
export async function generateGrammarSlides(
  passageText: string,
  passageTitle: string,
  passageIndex: number
): Promise<SlideItem[]> {
  const prompt = `You are an English grammar quiz creator for Korean high school students.

Based on the following reading passage, create a grammar quiz with EXACTLY 5~6 questions.
Each question must pick a REAL sentence from this passage and replace one word/phrase with two options.

PASSAGE (${passageTitle}):
${passageText}

Return ONLY valid JSON (no markdown):
{
  "grammarQuestions": [
    { "number": 1, "sentence": "The student (who / whom) I recommended won the prize.", "optionA": "who", "optionB": "whom", "grammarType": "관계대명사", "answer": "A", "explanation": "주격 관계대명사 who가 맞다. whom은 목적격으로 앞에 전치사나 뒤에 완전한 절이 필요하다." },
    { "number": 2, "sentence": "It was the teacher (that / what) changed his life.", "optionA": "that", "optionB": "what", "grammarType": "강조구문", "answer": "A", "explanation": "It is/was ~ that 강조구문. what은 선행사 없는 명사절 접속사이므로 불가." },
    { "number": 3, "sentence": "The results (suggested / were suggested) a new approach.", "optionA": "suggested", "optionB": "were suggested", "grammarType": "능동/수동", "answer": "A", "explanation": "주어 'The results'가 행위의 주체이므로 능동태 suggested가 맞다." }
  ]
}

RULES:
- 5~6 questions total
- Each sentence MUST be a real sentence from the passage above
- "sentence": full sentence with the two choices as "(optionA / optionB)"
- "answer": "A" or "B" (which option is grammatically correct)
- "grammarType": Korean grammar point name
- "explanation": Korean explanation why that answer is correct

ALLOWED grammar topics ONLY (choose from this list, mix evenly):
관계대명사/관계부사 | 능동/수동태 | 분사/분사구문 | 명사절접속사(what/that/if/whether) | 가주어/진주어 | 가목적어/진목적어 | 목적보어-5형식(do/to do/doing) | to부정사vs동명사 | 보어자리형용사vs부사 | 부정어도치 | 전치사+관계대명사 | 접속사vs관계사 | 강조구문(It is~that) | 병렬구조 | 부사절접속사(when/while/since 등)

ABSOLUTELY FORBIDDEN — DO NOT generate ANY question from these categories:
❌ 전치사 단독 선택: "in / on / at / by / of / with / for / from / to" 중에서 고르는 문제. 예) She is interested (in / on) music. → 절대 출제 금지
❌ 전치사+관계대명사는 허용이지만 전치사만 단독으로 묻는 문제는 금지
❌ 조동사(should/must/would/can/may 등) 관련 문제
❌ 수일치 단독(주어-동사 수 일치만 묻는 문제)
❌ 시제 선택(과거/현재/미래 시제 고르기)
❌ 비교 표현(as~as, 비교급+than)
❌ 관계사 생략 여부 판단
❌ be동사 종류(is/are/was/were 선택)
❌ 대명사 격(he/him, we/us 등)
❌ 어순 판단
❌ 구두점 오류
❌ 두 선택지 모두 맞는 경우

IMPORTANT: If a sentence from the passage only offers a preposition choice (like in/on/at/by/for/of/with), SKIP that sentence and find another sentence that tests an ALLOWED grammar topic.`;

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: 'You are an English grammar quiz creator. Return ONLY valid JSON. No markdown, no extra text.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 3000,
  });

  const text = response.choices[0].message.content || '';
  let jsonStr = text;
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1];
  else {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) jsonStr = m[0];
  }

  let grammarQuestions: any[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    grammarQuestions = parsed.grammarQuestions || [];
  } catch {
    return []; // 파싱 실패 시 해당 지문 grammar만 생략
  }

  if (grammarQuestions.length === 0) return [];

  const suffix = passageIndex > 0 ? ` — Passage ${passageIndex}` : '';

  const quizSlide: SlideItem = {
    id: `grammar-quiz-${passageIndex}`,
    projectId: '',
    order: 0,
    type: 'grammar-quiz',
    layout: 'title-content',
    data: { title: `어법 퀴즈${suffix}`, grammarQuestions },
    approved: false,
  };

  const answerSlide: SlideItem = {
    id: `grammar-answer-${passageIndex}`,
    projectId: '',
    order: 0,
    type: 'grammar-answer',
    layout: 'title-content',
    data: { title: `어법 퀴즈 — 정답 확인${suffix}`, grammarQuestions },
    approved: false,
  };

  return [quizSlide, answerSlide];
}
