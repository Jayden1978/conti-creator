import Groq from 'groq-sdk';
import type { SlideItem, SlideData, MinutesItem } from './types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 분석(ANALYSIS_PROMPT) 같은 대용량 단발성 프롬프트 전용 — agentic compound 모델은
// 분당 토큰(TPM) 한도가 70,000으로 넉넉하지만, 가끔 자체적으로 도구 호출을 시도하며
// 컨텍스트가 부풀어 "Request Entity Too Large(413)"를 반환하는 경우가 있어
// 결정적 출력이 중요한 구조화 JSON 생성에는 적합하지 않다.
const PRIMARY_MODEL = 'groq/compound';
const FALLBACK_MODEL = 'groq/compound-mini';
// 슬라이드별 구조화 JSON 생성(어휘/퀴즈/꼬리질문 등) 전용 — 도구 호출을 하지 않는 순수
// reasoning 모델이라 출력이 안정적이다. TPM 한도는 8,000으로 더 적지만 프롬프트가
// 작아서(장당 한 번 호출) 충분하다.
const STRUCTURED_MODEL = 'openai/gpt-oss-120b';
const STRUCTURED_FALLBACK_MODEL = 'qwen/qwen3.6-27b';
const VISION_MODEL = 'qwen/qwen3.6-27b';

/**
 * 이미지 파일들 + 프롬프트를 Groq 비전 모델(Qwen)에 보내고 텍스트 응답을 반환.
 * 이 모델의 무료(on_demand) 티어는 분당 8000 토큰(TPM) 제한이 있어 이미지를 한 번에 여러 장
 * 보내면 바로 초과되므로, 이미지를 한 장씩 순차 처리하고 결과를 이어붙인다.
 */
async function groqVision(
  imageFiles: { base64: string; mediaType: string }[],
  promptText: string,
  systemInstruction: string
): Promise<string> {
  const results: string[] = [];

  for (const file of imageFiles) {
    const content: Groq.Chat.ChatCompletionContentPart[] = [
      { type: 'image_url', image_url: { url: `data:${file.mediaType};base64,${file.base64}` } },
      { type: 'text', text: promptText },
    ];

    let pageResult = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await groq.chat.completions.create({
          model: VISION_MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content },
          ],
          max_tokens: 4000,
          reasoning_format: 'hidden',
        });
        const text = response.choices[0].message.content || '';
        if (text.trim()) { pageResult = text; break; }
        // 숨겨진 reasoning이 토큰 예산을 다 써서 빈 응답이 오는 경우가 있음 — 재시도
        if (attempt < 3) continue;
      } catch (e: any) {
        const status = e?.status ?? e?.error?.status;
        if (status === 429 && attempt < 3) {
          const msg = String(e?.error?.message || e?.message || '');
          const waitMatch = msg.match(/try again in ([\d.]+)s/i);
          const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : (attempt + 1) * 8000;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw e;
      }
    }
    results.push(pageResult);
  }

  return results.join('\n\n--- 다음 이미지 ---\n\n');
}

// groq/compound* 는 agentic(자체 도구 호출) 모델이라 reasoning_format을 지원하지 않음.
// gpt-oss/qwen 순수 reasoning 모델은 hidden reasoning에 쓰는 토큰이 max_tokens 예산을
// 먼저 소비해버려 정작 보이는 답변이 잘리거나 비어버리는 경우가 있어, reasoning_effort를
// 최소로 낮춰 답변에 예산을 더 배정한다 (모델별로 허용값이 달라 분기 필요: gpt-oss는
// low/medium/high, qwen은 none/default만 허용).
function reasoningExtra(model: string): Record<string, any> {
  if (model.startsWith('groq/compound')) return {};
  if (model.startsWith('openai/gpt-oss')) return { reasoning_format: 'hidden', reasoning_effort: 'low' };
  if (model.startsWith('qwen/')) return { reasoning_format: 'hidden', reasoning_effort: 'none' };
  return { reasoning_format: 'hidden' };
}

export async function groqChat(
  messages: any[],
  max_tokens = 4000,
  systemMsg?: string,
  extra?: Record<string, any>,
  models: string[] = [PRIMARY_MODEL, FALLBACK_MODEL]
): Promise<string> {
  const msgs = systemMsg
    ? [{ role: 'system', content: systemMsg }, ...messages]
    : messages;

  for (const model of models) {
    const modelExtra = { ...reasoningExtra(model), ...extra };
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await groq.chat.completions.create({ model, messages: msgs, max_tokens, ...modelExtra });
        return res.choices[0].message.content || '';
      } catch (e: any) {
        const status = e?.status ?? e?.error?.status;
        // 429: rate limit — retry-after 헤더 또는 오류 메시지에서 대기 시간 추출
        if (status === 429) {
          // 일일 한도(요청 수 또는 토큰 수, TPD/RPD)가 바닥난 경우는 몇 초 기다린다고
          // 회복되지 않으므로(리셋까지 수 분~수 시간) 재시도하지 말고 바로 다음 모델로.
          // "on tokens per day (TPD)"류 메시지는 "try again in 14m53s"처럼 분 단위가
          // 섞여 있어 초 단위 정규식이 잘못 파싱할 수 있어 메시지 자체로 먼저 걸러낸다.
          const remainingReq = e?.headers?.get?.('x-ratelimit-remaining-requests');
          const msg = String(e?.error?.message || e?.message || '');
          if (remainingReq === '0' || /per day|\bTPD\b|\bRPD\b/i.test(msg)) break;
          const waitMatch = msg.match(/try again in ([\d.]+)s/i);
          const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : (attempt + 1) * 5000;
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        // 503: over capacity / 413: 요청이 너무 큼(agentic 모델의 자체 도구 호출로 인한 컨텍스트 팽창 등) — 다음 모델 시도
        const is503 = status === 503 || String(e).includes('over capacity');
        const is413 = status === 413;
        if (is503 || is413) break;
        throw e;
      }
    }
  }
  throw new Error('Groq API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
}

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
7. NEVER ask a clarifying question or request additional material, even if the given text contains ONLY the passages with no question stems/choices/underlined text visible. In that case, write "Not provided in the source" for the missing fields and immediately proceed to extract every passage that IS present. Your reply must ALWAYS start directly with "1. Grade/Level" (the requested output format below) — never with a conversational sentence, an apology, or a request for more information.
8. A "PASSAGE" is defined by having its OWN exam question number and question type (목적/주제/제목/어법성판단/빈칸추론/etc). If the source material presents ONE reading passage broken across multiple lines labeled "문장 1", "문장 2", "Sentence 1", "①②③...", or similar sequential sentence labels — with NO separate question stem or answer choices between them — this is ONE passage split for line-by-line teaching, NOT multiple passages. MERGE all of these sentences IN ORDER into a SINGLE PASSAGE TEXT block (strip the "문장 N" labels, join the sentences into continuous prose), and emit only ONE "=== PASSAGE ===" entry for it. NEVER create a separate PASSAGE block per sentence.
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



export async function analyzeTextContent(text: string): Promise<string> {
  return groqChat(
    [{ role: 'user', content: `${ANALYSIS_PROMPT}\n\n--- 텍스트 ---\n${text}` }],
    8000,
    'You are an expert at extracting content from English lesson materials. Your most critical job is to copy ALL reading passages EXACTLY as written. Never summarize. Never ask a clarifying question or refuse — always attempt extraction with whatever is given and mark missing fields as not provided.'
  );
}

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
      try {
        const t = await extractPdfText(f.base64);
        if (t.trim()) texts.push(t.trim());
      } catch (e) {
        console.error('extractPdfText failed:', e);
      }
    }
    if (texts.length === 0) {
      throw new Error('PDF 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원되지 않는 형식(예: 스캔된 이미지 PDF)일 수 있습니다. 다른 PDF로 다시 시도하거나 페이지를 JPG/PNG로 변환해 업로드해주세요.');
    }

    const combined = texts.join('\n\n--- 다음 파일 ---\n\n');
    return groqChat(
      [{ role: 'user', content: `${ANALYSIS_PROMPT}\n\n--- PDF 추출 텍스트 ---\n${combined}` }],
      6000,
      'You are an expert at extracting content from English lesson materials. Your most critical job is to copy ALL reading passages EXACTLY as written. Never summarize. Never ask a clarifying question or refuse — always attempt extraction with whatever is given and mark missing fields as not provided.'
    );
  }

  /* ── 이미지 처리 (PDF 혼합 포함) ── */
  let promptText = ANALYSIS_PROMPT;

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
      promptText = `Additional text from PDF:\n${texts.join('\n\n')}\n\n${ANALYSIS_PROMPT}`;
    }
  }

  return groqVision(
    imageFiles.slice(0, 6),
    promptText,
    'You are an expert at extracting content from English lesson material images and text. Copy ALL reading passages EXACTLY as written. Never summarize. Never ask a clarifying question or refuse — always attempt extraction with whatever is given and mark missing fields as not provided.'
  );
}

// ── 내신대비용: 지문 텍스트만 추출하여 passage 슬라이드 생성 ──
async function generateNaeshinSlides(
  analysis: string,
  files: { type: 'image' | 'pdf'; base64: string; mediaType: string }[]
): Promise<SlideItem[]> {
  const imageFiles = files.filter((f) => f.type === 'image');

  // AI는 cover, objectives, passage만 생성 — 나머지는 코드에서 직접 삽입
  const promptText = `Here is the analyzed lesson material:
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
}`;

  const systemMsg = 'Extract passage texts exactly as written. Return ONLY valid JSON.';

  let text: string;
  if (imageFiles.length > 0) {
    // 이미지가 있으면 Groq 비전 모델(Qwen)로 재확인
    text = await groqVision(imageFiles.slice(0, 6), promptText, systemMsg);
  } else {
    // compound 계열(agentic)은 분석 텍스트를 그대로 되돌려 넣는 이 프롬프트에서 가끔
    // 자체 도구 호출을 시도하며 413을 반환하는 경우가 있어, 결정적 추출 작업이므로
    // 도구 호출이 없는 STRUCTURED_MODEL을 사용한다.
    text = await groqChat(
      [{ role: 'user', content: promptText }],
      4000,
      systemMsg,
      undefined,
      [STRUCTURED_MODEL, STRUCTURED_FALLBACK_MODEL]
    );
  }
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

  // 표지/학습목표 + 지문 슬라이드 반환 — 단어/퀴즈/피드백은 route에서 순서대로 조합
  const slides: SlideItem[] = [];
  let idx = 0;

  slides.push({
    id: `slide-${idx}`, projectId: '', order: ++idx,
    type: 'cover', layout: 'title-content',
    data: { title: parsed.title || '영어 수업', subtitle: parsed.subtitle || '' },
    approved: false,
  });
  slides.push({
    id: `slide-${idx}`, projectId: '', order: ++idx,
    type: 'objectives', layout: 'title-content',
    data: {
      title: '학습 목표',
      items: parsed.objectives?.length ? parsed.objectives : ['지문을 정확히 이해할 수 있다.', '핵심 어휘를 파악할 수 있다.', '글의 논리적 흐름을 파악할 수 있다.'],
    },
    approved: false,
  });

  for (const p of (parsed.passages || [])) {
    slides.push({
      id: `slide-${idx}`, projectId: '', order: ++idx,
      type: 'passage', layout: 'title-content',
      data: {
        title: p.title || `PASSAGE ${idx}`,
        passage: { text: p.text || '', questionNumber: undefined, questionType: '', underlinedText: '' },
        choices: [],
      },
      approved: false,
    });
  }

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
  const firstIdx = inline.search(/[①②③④⑤]/);
  if (firstIdx === -1) return byLine.slice(0, 5);
  const fromFirst = inline.slice(firstIdx);
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

// AI가 값이 없을 때 채워넣는 "*Not provided*" 류의 플레이스홀더 텍스트를 빈 문자열로 정리
function cleanPlaceholder(raw: string): string {
  const t = raw.trim().replace(/^\*+|\*+$/g, '').trim();
  if (!t) return '';
  if (/not provided|not specified|not given|none provided|^none$|없음|해당\s*없음/i.test(t)) return '';
  return t;
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
    const passageTextMatches = [...analysis.matchAll(/PASSAGE TEXT\**\s*:?\s*([\s\S]*?)(?=\n\s*\*{0,2}(?:CHOICES)\b|={3,}|#{2,}|$)/gi)];
    const choicesMatches = [...analysis.matchAll(/CHOICES\**\s*:?\s*([\s\S]*?)(?=\n\s*\*{0,2}(?:UNDERLINED|GIVEN)\b|={3,}|#{2,}|$)/gi)];
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
    // "23번" 처럼 숫자 뒤에 "번"이 붙은 실제 문제번호만 추출 (연도 "2024" 등의 앞 두 자리 오인식 방지)
    const qNumMatch = header.match(/(\d{1,3})\s*번/);
    const qNum = qNumMatch ? parseInt(qNumMatch[1]) : null;
    const qTypeMatch = header.match(/[—\-–]\s*(.+)/);
    const qType = qTypeMatch ? cleanPlaceholder(qTypeMatch[1].replace(/={1,}/g, '')) : '';

    // PASSAGE TEXT 섹션 추출 — 라벨 뒤 콜론 유무와 무관하게, 라벨 직후부터 다음 섹션 전까지 캡처
    // (콜론을 찾아 헤매는 방식은 콜론이 없으면 블록 뒤쪽 엉뚱한 콜론까지 건너뛰어버림)
    const textMatch = block.match(/PASSAGE TEXT\**\s*:?\s*([\s\S]*?)(?=\n\s*\*{0,2}(?:CHOICES|UNDERLINED TEXT|GIVEN SENTENCE)\b|={3,}|#{2,}|$)/i);
    let rawText = textMatch ? textMatch[1].trim() : '';

    // 라벨 없이 헤더 줄 바로 다음에 본문이 이어지는 경우 폴백 (모델이 "PASSAGE TEXT:" 라벨을 생략할 때)
    if (!rawText) {
      const bodyMatch = block.match(/\n([\s\S]*?)(?=CHOICES|UNDERLINED TEXT|GIVEN SENTENCE|={3,}|#{2,}|$)/i);
      rawText = bodyMatch ? bodyMatch[1].trim() : '';
    }
    // 모델이 지문을 마크다운 코드블록(```)으로 감싼 경우 펜스 제거
    rawText = rawText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '').trim();

    // CHOICES 섹션 추출
    const choicesMatch = block.match(/CHOICES\**\s*:?\s*([\s\S]*?)(?=\n\s*\*{0,2}(?:UNDERLINED TEXT|GIVEN SENTENCE)\b|={3,}|#{2,}|$)/i);
    const choicesRaw = choicesMatch ? cleanPlaceholder(choicesMatch[1]) : '';
    const choices = splitChoices(choicesRaw);

    // UNDERLINED TEXT 추출
    const underlinedMatch = block.match(/UNDERLINED TEXT\**\s*[:\-–—]?\s*([^\n]*)/i);
    const underlinedText = underlinedMatch ? cleanPlaceholder(underlinedMatch[1].replace(/^\[|\]$/g, '')) : '';

    // GIVEN SENTENCE 추출 (문장삽입)
    const givenMatch = block.match(/GIVEN SENTENCE\**\s*[:\-–—]?\s*([^\n]*)/i);
    const givenSentence = givenMatch ? cleanPlaceholder(givenMatch[1].replace(/^\[|\]$/g, '')) : '';

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
  const metaText = await groqChat(
    [{ role: 'user', content: `Based on this English lesson analysis, return ONLY this JSON:
{
  "title": "수업 제목 (Korean, e.g. 모의고사 대비)",
  "subtitle": "학년 · 단원 (e.g. 고2 · 모의고사 3월)",
  "objectives": ["~을/를 이해할 수 있다.", "~을/를 설명할 수 있다.", "~을/를 파악할 수 있다.", "~을/를 적용할 수 있다."]
}

Analysis summary (first 800 chars):
${analysis.slice(0, 800)}` }],
    400,
    'Return ONLY valid JSON, no markdown.',
    undefined,
    [STRUCTURED_MODEL, STRUCTURED_FALLBACK_MODEL]
  );
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


/** 회의 메모 파일(이미지/PDF)을 순수 텍스트로 변환 — record 단계에서 rawNotes에 저장할 텍스트를 만든다 */
export async function extractRawTextFromFiles(
  files: { type: 'image' | 'pdf'; base64: string; mediaType: string }[]
): Promise<string> {
  const imageFiles = files.filter((f) => f.type === 'image');
  const pdfFiles = files.filter((f) => f.type === 'pdf');
  const parts: string[] = [];

  if (pdfFiles.length > 0) {
    for (const f of pdfFiles) {
      try {
        const t = await extractPdfText(f.base64);
        if (t.trim()) parts.push(t.trim());
      } catch (e) {
        console.error('extractPdfText failed:', e);
      }
    }
  }

  if (imageFiles.length > 0) {
    const visionText = await groqVision(
      imageFiles.slice(0, 6),
      '이 이미지는 영어과 회의 메모입니다. 손글씨나 화이트보드 내용을 그대로 텍스트로 옮겨 적어주세요.',
      '너는 회의 메모 이미지를 정확히 텍스트로 옮기는 전문가다. 요약하지 말고 보이는 내용을 그대로 옮겨라.'
    );
    if (visionText.trim()) parts.push(visionText.trim());
  }

  return parts.join('\n\n');
}

/** 회의 원본 메모(텍스트) → 안건/논의/결정/실행항목으로 구조화된 MinutesItem[] 생성 */
export async function generateMeetingMinutesItems(rawNotes: string): Promise<MinutesItem[]> {
  const sourceText = rawNotes || '';
  if (!sourceText.trim()) throw new Error('회의 메모 내용이 없습니다.');

  const prompt = `다음은 영어과 회의에서 작성된 원본 메모다. 이를 정리된 회의록 항목으로 구조화하라.

원본 메모:
${sourceText.slice(0, 6000)}

RULES:
- 안건(agendaItems)은 메모에서 다뤄진 논의 주제를 짧은 제목 형태로 추출.
- 각 논의(discussions)는 대응하는 안건 제목(agenda)과 실제 논의된 내용(content, 한국어 문장)으로 구성.
- 결정사항(decisions)은 실제로 합의/결정된 내용만 포함 (단순 의견 제시는 제외).
- 실행항목(actionItems)은 "누가 무엇을 언제까지" 형태로 추출 가능한 것만 포함. 담당자(owner)나 기한(dueDate)이 메모에 없으면 빈 문자열로 둔다.
- 메모에 없는 내용을 지어내지 않는다.

Return ONLY this JSON (no markdown):
{
  "agendaItems": ["안건 제목 1", "안건 제목 2"],
  "discussions": [{ "agenda": "안건 제목 1", "content": "논의 내용" }],
  "decisions": ["결정사항 1", "결정사항 2"],
  "actionItems": [{ "task": "할 일", "owner": "담당자", "dueDate": "기한" }]
}`;

  const text = await groqChat(
    [{ role: 'user', content: prompt }],
    4000,
    '너는 한국 영어과 회의 메모를 정리하는 어시스턴트다. Return ONLY valid JSON, no markdown.',
    undefined,
    [STRUCTURED_MODEL, STRUCTURED_FALLBACK_MODEL]
  );

  let jsonStr = text;
  const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) jsonStr = cb[1];
  else { const i = text.indexOf('{'); if (i >= 0) jsonStr = text.slice(i); }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    try {
      let s = jsonStr.replace(/,\s*$/, '');
      let b = 0, br = 0, inStr = false, esc = false;
      for (const c of s) {
        if (esc) { esc = false; continue; }
        if (c === '\\' && inStr) { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (!inStr) { if (c === '{') b++; else if (c === '}') b--; else if (c === '[') br++; else if (c === ']') br--; }
      }
      for (let i = 0; i < br; i++) s += ']';
      for (let i = 0; i < b; i++) s += '}';
      parsed = JSON.parse(s);
    } catch {
      throw new Error('회의록 생성 실패: JSON 파싱 오류');
    }
  }

  const items: MinutesItem[] = [];
  let order = 0;

  for (const a of parsed.agendaItems || []) {
    items.push({ id: `agenda-${order}`, meetingId: '', order: order++, type: 'agenda', data: { title: String(a) }, done: false });
  }
  for (const d of parsed.discussions || []) {
    items.push({ id: `discussion-${order}`, meetingId: '', order: order++, type: 'discussion', data: { title: String(d?.agenda || ''), content: String(d?.content || '') }, done: false });
  }
  for (const d of parsed.decisions || []) {
    items.push({ id: `decision-${order}`, meetingId: '', order: order++, type: 'decision', data: { content: String(d) }, done: false });
  }
  for (const a of parsed.actionItems || []) {
    items.push({ id: `action-${order}`, meetingId: '', order: order++, type: 'action-item', data: { task: String(a?.task || ''), owner: String(a?.owner || ''), dueDate: String(a?.dueDate || '') }, done: false });
  }

  if (items.length === 0) throw new Error('회의록 항목을 추출하지 못했습니다.');

  return items;
}

/** 지문 1개에 대한 어휘 + OX 퀴즈/답 슬라이드 생성 */
export async function generateReadingActivitySlide(
  passageText: string,
  passageTitle: string,
  passageIndex: number,
  isNaeshin: boolean = false
): Promise<SlideItem> {
  const prompt = isNaeshin
    ? `Based on this English passage, create 6 sequential reading-comprehension short-answer(서술형) questions in KOREAN for 내신(exam-prep) students, with a model answer for each.

PASSAGE:
${passageText}

Return ONLY this JSON (no markdown, no extra text):
{
  "subQuestions": [
    "질문 1 (한국어, ~는가?로 끝나는 의문문)",
    "질문 2", "질문 3", "질문 4", "질문 5", "질문 6"
  ],
  "answers": [
    "질문 1에 대한 모범 답안 (지문 내용을 근거로 한 완전한 한국어 문장)",
    "질문 2 답안", "질문 3 답안", "질문 4 답안", "질문 5 답안", "질문 6 답안"
  ]
}

CRITICAL RULES (예시: "1. 사람들은 과학을 일반적으로 누구를 위한 영역이라고 생각하는가?" 같은 스타일):
- Write ALL questions and answers in 한국어 (Korean) ONLY
- Do NOT use any Cyrillic, Russian, or other non-Korean/non-English characters
- 정확히 6개의 질문과 6개의 답안을 순서대로 1:1 대응시킬 것 (subQuestions[i]의 답이 answers[i])
- 질문은 지문의 서술 순서를 따라가며(처음→끝) 지문에 명시적으로 서술된 내용을 이해했는지 확인하는 것이어야 한다 — 추론/유추가 필요한 질문은 절대 금지.
- 지문에 등장하는 이름·용어·숫자 등을 단순히 "찾아 쓰시오/나열하시오" 하는 디테일한 암기·나열형 질문은 절대 금지 (예: "지문에 나온 인물의 이름을 모두 쓰시오"). 이런 질문은 관련성이 낮고 컴플레인 요소가 된다.
- 각 질문은 "누가/무엇을/왜/어떻게/무엇이" 등 5W1H 의문형으로, 지문의 한 부분(사건·이유·과정·수치 등)에 대응시킬 것.
- 답안은 지문 내용을 바탕으로 한 완전한 한국어 문장 1개로 작성 (해당 지문 부분을 자연스럽게 풀어쓴 것).`
    : `Based on this English passage, create 3 discussion questions in KOREAN (한국어) only.

PASSAGE:
${passageText}

Return ONLY this JSON (no markdown, no extra text):
{
  "mainQuestion": "여기에 한국어 질문 (~봅시다! 또는 ~해보세요! 로 끝낼 것)",
  "subQuestions": [
    "여기에 한국어 세부 질문 1",
    "여기에 한국어 세부 질문 2"
  ]
}

CRITICAL RULES:
- Write ALL questions in 한국어 (Korean) ONLY
- Do NOT use any Cyrillic, Russian, or other non-Korean/non-English characters
- mainQuestion: open-ended, ends with "~봅시다!" or "~해보세요!"
- subQuestions: exactly 2, based on specific content in the passage
- Keep questions short and clear`;

  let text = '';
  try {
    text = await groqChat(
      [{ role: 'user', content: prompt }],
      isNaeshin ? 1200 : 500,
      'You write questions in Korean (한국어) only. Return ONLY valid JSON. No markdown. Never use Cyrillic characters.',
      undefined,
      [STRUCTURED_MODEL, STRUCTURED_FALLBACK_MODEL]
    );
  } catch (e) {
    console.error('generateReadingActivitySlide failed:', e);
  }
  const m = text.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = JSON.parse(m?.[0] ?? '{}'); } catch { /* fallback */ }

  const data: SlideData = isNaeshin
    ? {
        title: `독해 문제 — Passage ${passageIndex}`,
        subQuestions: parsed.subQuestions?.length ? parsed.subQuestions : ['지문의 핵심 내용을 설명하시오.'],
        answers: parsed.answers?.length ? parsed.answers : ['지문 내용을 참고하여 답하시오.'],
      }
    : {
        title: `독해 활동 — Passage ${passageIndex}`,
        mainQuestion: parsed.mainQuestion || '지문의 핵심 내용을 설명해 봅시다!',
        subQuestions: parsed.subQuestions?.length ? parsed.subQuestions : ['지문에서 중요한 내용은?', '이 지문의 핵심 주제는?'],
      };

  return {
    id: `reading-activity-${passageIndex}`,
    projectId: '',
    order: 0,
    type: 'reading-activity',
    layout: 'title-content',
    data,
    approved: false,
  };
}

// ── 지문을 문장 단위로 분할 (약어/소수점의 마침표는 문장 경계로 오인하지 않음) ──
const SENTENCE_ABBREVS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'etc', 'eg', 'ie', 'us', 'uk', 'no', 'inc', 'jr', 'sr', 'ph', 'd',
]);

function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c !== '.' && c !== '!' && c !== '?') continue;

    // 소수점(숫자.숫자)은 문장 경계가 아님
    if (c === '.' && /\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')) continue;

    // 직전 단어가 약어 목록에 있으면 문장 경계가 아님
    if (c === '.') {
      const precedingWord = t.slice(0, i).match(/([A-Za-z]+)$/)?.[1] || '';
      if (SENTENCE_ABBREVS.has(precedingWord.toLowerCase())) continue;
    }

    // 마침표 뒤가 닫는 따옴표/공백을 건너뛰고 대문자나 문장 끝이면 문장 경계로 인정
    let j = i + 1;
    while (j < t.length && /[\s"'”’]/.test(t[j])) j++;
    const nextChar = t[j];
    if (j >= t.length || /[A-Z"'“‘]/.test(nextChar)) {
      sentences.push(t.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = t.slice(start).trim();
  if (rest) sentences.push(rest);

  return sentences.filter((s) => s.length > 0);
}

/**
 * 지문 1개를 "한 줄 영어" 방식으로 문장 단위 슬라이드 + 문장 전환마다 꼬리질문 슬라이드로 변환한다.
 * AI 호출 없이 결정적으로 문장을 분할하고, 꼬리질문은 정답을 알려주지 않는 고정 템플릿 문구를 사용한다
 * (연결어/지시어를 학생이 스스로 찾게 하는 방식 — [[project-jungyoul-academy-ibl]] 한 줄 영어 포맷 참고).
 */
export function generateLineEnglishSlides(
  passageText: string,
  passageTitle: string,
  passageIndex: number
): SlideItem[] {
  const sentences = splitSentences(passageText).map((text, i) => ({ number: i + 1, text }));
  if (sentences.length < 2) return [];

  const suffix = passageIndex > 0 ? ` — Passage ${passageIndex}` : '';
  const total = sentences.length - 1;
  const slides: SlideItem[] = [];

  slides.push({
    id: `line-english-${passageIndex}`,
    projectId: '',
    order: 0,
    type: 'line-english',
    layout: 'title-content',
    data: { title: `한 줄 영어${suffix}`, lineEnglishSentences: sentences },
    approved: false,
  });

  for (let i = 0; i < total; i++) {
    const prev = sentences[i];
    const next = sentences[i + 1];
    slides.push({
      id: `line-english-tail-${passageIndex}-${i + 1}`,
      projectId: '',
      order: 0,
      type: 'line-english-tail',
      layout: 'title-content',
      data: {
        title: `한 줄 영어 · 꼬리질문${suffix}`,
        lineEnglishPair: {
          prevNumber: prev.number,
          prevText: prev.text,
          nextNumber: next.number,
          nextText: next.text,
          index: i + 1,
          total,
        },
      },
      approved: false,
    });
  }

  return slides;
}

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

  let text = '';
  try {
    text = await groqChat(
      [{ role: 'user', content: prompt }],
      3000,
      'You are a Korean English teacher assistant. Return ONLY valid JSON. No markdown, no extra text.',
      undefined,
      [STRUCTURED_MODEL, STRUCTURED_FALLBACK_MODEL]
    );
  } catch (e) {
    console.error('generateVocabAndOXSlides failed:', e);
    return [];
  }
  let jsonStr = text;
  const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) jsonStr = cb[1];
  else { const m = text.match(/\{[\s\S]*\}/); if (m) jsonStr = m[0]; }

  let vocabData: any = {};
  try { vocabData = JSON.parse(jsonStr); } catch {
    console.error('generateVocabAndOXSlides: JSON parse failed, raw text:', text.slice(0, 500));
    return [];
  }

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
  passageIndex: number,
  isNaeshin: boolean = false
): Promise<SlideItem[]> {
  const count = isNaeshin ? 4 : 5;
  const prompt = `You are an English grammar quiz creator for Korean high school students.

Based on the following reading passage, create a grammar quiz with EXACTLY ${count} questions.
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
- Exactly ${count} questions total
- Each sentence MUST be a real sentence from the passage above (copy it exactly, only changing the tested word/phrase into "(optionA / optionB)")
- "sentence": full sentence with the two choices as "(optionA / optionB)"
- "answer": "A" or "B" (which option is grammatically correct)
- "grammarType": Korean grammar point name (use the exact names from the ALLOWED list below)
- "explanation": ONE concise Korean sentence (under 60 characters) focusing on the grammatical structure/rule, NOT about meaning — do not write multi-sentence explanations

ALLOWED grammar topics — pick ${count} DIFFERENT topics from this list, do NOT repeat the same topic twice:
1. 관계대명사/관계부사 — who/whom/which/that/where/when, including 계속적 용법 (which vs that)
2. 능동/수동 — active vs passive voice, including passive in participial phrases
3. 분사/분사구문 — present participle (V-ing) vs past participle (p.p.), including absolute constructions
4. 명사절접속사 — what vs that, if vs whether
5. 가주어/진주어 — It ~ to/that constructions
6. 가목적어/진목적어 — make it possible to / find it difficult to
7. 목적보어-5형식 — make/let/have him (do / to do / doing)
8. to부정사vs동명사 — remember to do vs remember doing, stop to do vs stop doing
9. 보어자리형용사vs부사 — look (careful / carefully), feel (good / well)
10. 부정어도치 — Never / Seldom / Not only ... (do+S+V vs S+V)
11. 전치사+관계대명사 — the reason (for which / which) / the way (in which / how) — NOT just choosing between two prepositions
12. 접속사vs관계사 — (although / despite), (because / because of), (while / during)
13. 강조구문 — It is/was ~ that/who (강조구문 vs 명사절)
14. 병렬구조 — (to V / V-ing) in parallel structures, matching conjunctions
15. 부사절접속사 — when/while/since/as/because/although/unless/once

=== STRICTLY FORBIDDEN — these will make the quiz WRONG, DO NOT USE ===

❌ TENSE questions (ALL forms forbidden):
   - simple past vs simple present: (changed / changes)
   - past vs present perfect: (liked / had liked)  ← THIS IS FORBIDDEN
   - simple vs progressive: (want / are wanting)   ← THIS IS FORBIDDEN
   - passive simple vs passive progressive: (is measured / is being measured) ← BOTH ARE PASSIVE = this is a tense question = FORBIDDEN
   - any selection where BOTH options are the same verb but different tenses or aspects

❌ 능동/수동 문제 제작 규칙 (CRITICAL):
   - 능동/수동 문제는 반드시 한 쪽은 능동(active), 다른 한 쪽은 수동(passive)이어야 함
   - 두 선택지 모두 수동이면 → 시제 문제이므로 절대 금지
   - 두 선택지 모두 능동이면 → 다른 유형으로 분류할 것
   - 올바른 예: (suggested / were suggested), (trained / were trained), (associates / is associated)

❌ PREPOSITION-only questions (forbidden even if labelled differently):
   - (in / at), (by / of), (for / with), (on / in) etc. — two plain prepositions
   - 전치사+관계대명사 means FULL prepositional relative clause structure, NOT just picking between two prepositions

❌ Modal verbs — forbidden in ALL forms:
   - choosing between two modals: (should / must), (can / could), (would / will)
   - the verb form AFTER a modal: (should go / should goes)
   - negative contraction choice: (do not / don't)

❌ 보어 자리에 to부정사 vs 동명사: (My goal is to succeed / succeeding) — this specific subject-complement pattern is forbidden even though to부정사vs동명사 is otherwise an allowed topic (e.g., remember to do / remember doing is still fine).

❌ Subject-verb agreement alone: (is / are), (has / have) as the only difference — and even when combined with another topic, do not repeat 수일치 as the dominant pattern across the 5 questions.

❌ be-verb selection: (is / was / are / were)

❌ Comparison: (more ~ than / as ~ as), comparative/superlative forms

❌ Pronoun case: (he / him), (we / us), (who / whom) ONLY when testing accusative vs nominative case without relative clause context

❌ Relative clause omission: whether a relative pronoun can be omitted

❌ Word order / punctuation

❌ Both options are grammatically correct

❌ VOCABULARY substitution disguised as grammar (CRITICAL):
   - optionA and optionB must be two GRAMMATICAL FORMS of the SAME underlying word/structure tied to one ALLOWED topic above (e.g., who/whom, suggested/were suggested, to go/going) — NEVER two different words with different meanings/lemmas.
   - FORBIDDEN examples: (time / day), (Today / Tomorrow), (happy / sad), (big / large) — these are vocabulary/collocation choices, not grammar, no matter what grammarType label you put on them.
   - Test before writing: if a native speaker would pick the answer based on MEANING or collocation (not grammatical form), this is forbidden — discard it and pick a different sentence.
   - The sentence must actually contain the grammatical trigger for the chosen topic (e.g., 부정어도치 requires an actual negative adverb like Never/Seldom/Not only at the front — don't label an unrelated word-choice sentence as 부정어도치 just because no other topic fits).

BEFORE writing each question, ask yourself:
"Am I testing a TENSE difference? Am I choosing between two plain prepositions? Am I testing a modal verb? Are optionA/optionB actually two DIFFERENT WORDS with different meanings rather than two forms of the same grammar point?"
If YES to any → SKIP that sentence and find a different one.`;


  let text = '';
  try {
    text = await groqChat(
      [{ role: 'user', content: prompt }],
      4500,
      'You are an English grammar quiz creator. Return ONLY valid JSON. No markdown, no extra text.',
      undefined,
      [STRUCTURED_MODEL, STRUCTURED_FALLBACK_MODEL]
    );
  } catch (e) {
    console.error('generateGrammarSlides failed:', e);
    return [];
  }
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
    console.error('generateGrammarSlides: JSON parse failed, raw text:', text.slice(0, 500));
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

/**
 * 어법성판단(①②③④⑤ 밑줄 오류찾기) 지문의 각 밑줄 항목에 대해
 * 구조 규칙 기반 "꼬리질문" 체인을 생성한다 (Lecture Note 형식).
 * 절대 해석/문맥 의미로 판단시키지 않고, 품사·목적어 유무·수일치·병렬구조 등
 * 재현 가능한 구조 규칙 단계로만 판단하도록 설계한다.
 */
export async function generateGrammarChainSlide(
  passageText: string,
  passageTitle: string,
  passageIndex: number
): Promise<SlideItem | null> {
  const prompt = `당신은 한국 고등학생을 위한 영어 어법(문법) 강사입니다.
아래는 ①②③④⑤ (또는 (1)(2)(3)(4)(5)) 로 표시된 5개의 밑줄 어법 오류찾기 지문입니다.

지문:
${passageText}

각 밑줄 항목(①~⑤, 순서대로)에 대해, 학생이 "해석/문맥상 뜻"이 아니라 오직 구조 규칙(품사, 목적어 유무, 절의 완전/불완전, 수일치, 능동/수동, 병렬구조, to부정사 vs 동명사 등)만 기계적으로 따라가며 스스로 판단할 수 있도록, 단계별 "꼬리질문" 체인을 만드세요.

각 단계 질문은 짧고 명확한 Yes/No 또는 단답형 질문이어야 하며, 마지막 단계에서 결론(적절/부적절)이 자연스럽게 나와야 합니다. 정확히 하나의 항목만 어법상 틀려야 합니다 (correct: false).

각 항목의 steps는 2~3개, 반드시 구조 규칙 확인 질문만 사용하고 "문맥상 뜻이 무엇인가"류의 의미 해석 질문은 절대 포함하지 마세요 (단, 단어 자체의 품사/뜻을 짧게 확인하는 것은 허용).

**중요 (대칭성, 정답 비노출):** correct:true 항목과 correct:false 항목의 steps는 형식·단계 수·질문 스타일이 서로 구별되지 않도록 대칭적으로 작성하세요. 즉, 모든 항목이 동일하게 "구조 확인 → 구조 확인 → (필요시) 일치 여부 확인" 흐름의 중립적인 Yes/No·단답형 질문만 사용해야 합니다. correct:false 항목이라고 해서 마지막 단계에 "올바른 형태는 무엇인가?", "정답은?" 같은 개방형 질문을 넣어 정답을 암시하지 마세요 — 오답 항목도 다른 항목과 완전히 같은 톤·같은 단계 수(2~3개)의 구조 확인형 질문으로만 구성해서, steps만 보고는 어느 항목이 오답인지 알 수 없어야 합니다.

각 항목을 판정할 때 아래 구조 규칙 체크리스트 중 해당하는 것을 사용하세요:
- 관계대명사 that/which/who vs 접속사 that vs 관계대명사 what: 뒤 절이 완전한 절(주어+동사+목적어/보어 모두 있음)이면 반드시 접속사 that(또는 완전한 명사절), 불완전한 절(하나가 빠짐)이면 관계대명사 that/which/who 또는 what. "what"은 반드시 선행사가 없고 뒤 절이 불완전해야만 쓸 수 있다 — 뒤 절이 완전하면 what은 틀림.
- 능동/수동: 그 동사 뒤에 목적어(명사)가 있으면 능동(V-ing/원형), 없으면 수동(p.p./be p.p.)
- 준동사 vs 정동사: 접속사·관계사 없이 절이 이어지면 반드시 정동사(본동사) 필요. 준동사(V-ing, p.p., to V)는 본동사 자리에 올 수 없다.
- remember/forget/stop + to V (미래에 할 일) vs + V-ing (과거에 한 일의 기억) — 문맥이 과거 회상이면 V-ing가 맞고, 앞으로 할 일이면 to V가 맞다. 이는 구조(시제/문맥의 시점) 규칙이지 어휘 의미 문제가 아니다.
- 주어-동사 수일치: 진짜 주어(수식어/삽입구 제외)를 찾아 단복수 확인
- 병렬구조: and/or/but으로 연결된 두 요소가 같은 문법 형태(둘 다 to V, 둘 다 V-ing 등)인지 확인
- 형용사 vs 부사: 보어 자리(감각동사/be동사 뒤)면 형용사, 동사/형용사 수식이면 부사
- 대동사(do/does/did vs be동사): 앞 문장의 "동작 동사구"를 대신 받을 때는 do/does/did를 쓴다. be동사는 앞의 be동사(상태)만 대신할 수 있고, 동작 동사구를 대신할 수 없다.

먼저 ①~⑤ 각 항목을 하나씩 순서대로 분석하세요. 각 항목마다: (a) 위 체크리스트 중 어떤 규칙이 적용되는지, (b) 그 규칙에 따라 실제 문장 구조를 확인한 결과, (c) 적절한지 아닌지를 한국어로 짧게 서술하세요.

(c)를 쓰기 전에 반드시 확인하세요: (c)의 결론은 (b)에서 확인한 구조적 사실과 논리적으로 정확히 일치해야 합니다. 만약 (b)에서 "~해야 한다"고 확인한 형태가 실제 밑줄 표현과 일치한다면 반드시 "적절함"이고, 불일치한다면 "부적절함"입니다. (b)와 (c)가 모순되면 (c)를 (b) 기준으로 다시 쓰세요.

5개 항목을 모두 분석한 뒤, 정확히 하나의 오류를 최종 확정하세요.

분석이 끝나면 아래 구분선을 쓰고, 그 뒤에 최종 결과 JSON만 출력하세요 (구분선 앞의 분석 내용은 그대로 남겨도 됩니다):

===FINAL_JSON===
{
  "chainQuestions": [
    {
      "number": 1,
      "label": "밑줄 친 단어/구 그대로 (지문에서 정확히 복사)",
      "tag": "이 항목이 확인하는 문법 포인트 (예: 관계대명사·선행사 확인, 주어-동사 수일치, 병렬구조 등)",
      "steps": ["구조 규칙 확인 질문 1", "구조 규칙 확인 질문 2", "..."],
      "correct": true
    },
    {
      "number": 4,
      "label": "engaging",
      "tag": "문장의 본동사 확인 (핵심 오류)",
      "steps": ["이 문장에는 접속사·관계사 없이 이어지는 주절 동사 자리가 필요한가?", "engaging은 문장의 본동사가 될 수 있는 정동사인가, 준동사인가?", "주어의 수와 이 형태가 서로 맞는가?"],
      "correct": false,
      "fix": "engaging → engage"
    }
  ]
}

RULES:
- 정확히 5개 항목, number는 1~5
- label은 마커(①②③④⑤ 또는 (1)(2)(3)(4)(5)) 바로 뒤에 오는 밑줄 대상 단어 1~2개만 (전체 구/절 전체를 복사하지 말 것 — 예: "possessing", "be found", "eager", "collecting", "is so" 처럼 짧게)
- correct: false인 항목은 정확히 1개, 나머지 4개는 correct: true
- correct: false인 항목에는 반드시 "fix" 필드 포함 (형식: "틀린표현 → 올바른표현", label과 같은 짧은 단위로)
- steps는 한국어, 구조 규칙만 사용 (해석/문맥 의미 판단 절대 금지)`;

  let text = '';
  try {
    text = await groqChat(
      [{ role: 'user', content: prompt }],
      4000,
      'You are a Korean English grammar teacher. Think through each item step by step in Korean before committing to a final answer, then output the final result after the ===FINAL_JSON=== marker as instructed.',
      { temperature: 0.2 },
      [STRUCTURED_MODEL, STRUCTURED_FALLBACK_MODEL]
    );
  } catch (e) {
    console.error('generateGrammarChainSlide failed:', e);
    return null;
  }
  const afterMarker = text.split('===FINAL_JSON===').pop() || text;
  let jsonStr = afterMarker;
  const codeBlock = afterMarker.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1];
  else {
    const m = afterMarker.match(/\{[\s\S]*\}/);
    if (m) jsonStr = m[0];
  }

  let chainQuestions: any[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    chainQuestions = parsed.chainQuestions || [];
  } catch {
    console.error('generateGrammarChainSlide: JSON parse failed, raw text:', text.slice(0, 500));
    return null;
  }

  if (chainQuestions.length === 0) return null;

  const suffix = passageIndex > 0 ? ` — Passage ${passageIndex}` : '';

  return {
    id: `grammar-chain-${passageIndex}`,
    projectId: '',
    order: 0,
    type: 'grammar-chain',
    layout: 'title-content',
    data: { title: `${passageTitle} — 꼬리질문 활동${suffix}`, chainQuestions },
    approved: false,
  };
}
