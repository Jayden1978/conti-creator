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
- 빈칸추론: passage text has ____ blank(s); the choices are words or phrases to fill in
- 글의순서: the question asks to arrange (A)(B)(C) paragraphs in order; choices are like "(A)-(C)-(B)"
- 흐름과무관한문장: asks which sentence does not fit the flow (①②③④⑤ are sentence numbers at START of sentences)
- 주제/요지/제목/심경/함의/지칭: comprehension questions with 5 Korean/English phrase choices
- 어법성판단: the question says "밑줄 친 부분 중, 어법상 틀린 것은?" — about GRAMMAR errors; ①②③④⑤ inline in passage
- 어휘 적절성: the question says "밑줄 친 낱말 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?" OR "문맥상 어색한 어휘" — about VOCABULARY that is wrong in CONTEXT; ①②③④⑤ inline in passage marking individual words
  *** CRITICAL: If the question asks about vocabulary/word choice inappropriateness in context → "어휘 적절성". If it asks about grammar errors → "어법성 판단". These are DIFFERENT types even though both have ①②③④⑤ inline. ***
- 알맞은표현(어법): "(A)(B)(C) 각 네모에서 어법에 맞는 표현" with [word1/word2] choices in text

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
   [For 알맞은표현(어법): The exam shows a table with (A)(B)(C) columns and 5 rows. Copy each row as one choice string:
    "① [A-value] - [B-value] - [C-value]", "② ...", "③ ...", "④ ...", "⑤ ..."
    Example: "① satisfied - their - because", "② satisfied - whose - because of", etc.
    NEVER use JSON objects. Always extract all 5 full-row combinations.]
   [For others: copy all 5 choices ①②③④⑤ verbatim]

   UNDERLINED TEXT: [exact phrase that is underlined in the original, if any — not for 어법성판단]
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

export async function generateSlides(
  analysis: string,
  files: { type: 'image' | 'pdf'; base64: string; mediaType: string }[]
): Promise<SlideItem[]> {
  const imageFiles = files.filter((f) => f.type === 'image');

  const content: Groq.Chat.ChatCompletionContentPart[] = [];

  for (const file of imageFiles.slice(0, 6)) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${file.mediaType};base64,${file.base64}` },
    });
  }

  content.push({
    type: 'text',
    text: `Here is the analyzed lesson material:
===
${analysis}
===

Generate English lesson slides as JSON. Return ONLY valid JSON, no markdown, no explanation.

==== ABSOLUTE RULES — NEVER VIOLATE ====
A. NEVER change the question type. Use EXACTLY the questionType from the analysis.
B. NEVER rewrite passage text. Copy it CHARACTER BY CHARACTER from the analysis.
C. For 어법성판단: the passage text MUST contain ①②③④⑤ INLINE. These Unicode circled numbers (①②③④⑤) mark the underlined words. They MUST appear inside the passage text exactly where they are in the analysis. DO NOT put them only in the choices array. DO NOT delete them from the text.
D. For 빈칸추론: the ____ blank MUST stay in the passage text.
E. For 글의순서: (A)(B)(C) sections MUST stay in the passage text.
===========================================

SLIDE ORDER: cover → feedback → assignment-feedback → common-qa → objectives → [passage per passage] → summary → micro-feedback
NOTE: vocabulary/ox-quiz/ox-answer are generated separately — do NOT include here.

JSON structure:
{
  "slides": [
    { "type": "cover", "data": { "title": "Lesson Title", "subtitle": "Grade/Unit" } },
    { "type": "feedback", "data": { "title": "Micro Feedback", "items": ["지난 시간에 배운 내용을 떠올려보세요.", "기억에 남는 단어나 표현이 있나요?", "오늘 수업에서 기대하는 것은 무엇인가요?"] } },
    { "type": "assignment-feedback", "data": { "title": "과제 피드백", "items": ["지난 과제에서 많이 틀린 문제 유형은 무엇이었나요?", "어려웠던 어휘나 표현을 다시 확인해봅시다.", "모범 답안과 자신의 답을 비교해보세요."] } },
    { "type": "common-qa", "data": { "title": "공통질문 풀이", "items": ["이 지문에서 가장 어려운 문법 포인트는 무엇인가요?", "주제문을 찾는 방법에 대해 질문이 있나요?", "어휘 중 뜻이 헷갈리는 단어가 있었나요?"] } },
    { "type": "objectives", "data": { "title": "학습 목표", "items": ["~을/를 이해할 수 있다.", "~을/를 설명할 수 있다.", "~을/를 파악할 수 있다."] } },
    { "type": "passage", "data": { "title": "29번 — 어법성 판단", "passage": { "text": "Passage text WITH ①②③④⑤ markers inline e.g. 'people ① who hold a more interdependent self ② tend to cope...'", "questionNumber": 29, "questionType": "어법성 판단", "underlinedText": "" }, "choices": ["①", "②", "③", "④", "⑤"] } },
    { "type": "passage", "data": { "title": "33번 — 빈칸 추론", "passage": { "text": "Full passage text here with ____ blank preserved.", "questionNumber": 33, "questionType": "빈칸 추론", "underlinedText": "" }, "choices": ["① choice text", "② choice text", "③ choice text", "④ choice text", "⑤ choice text"] } },
    { "type": "passage", "data": { "title": "36번 — 글의 순서", "passage": { "text": "Intro paragraph.\n\n(A) Section A text.\n\n(B) Section B text.\n\n(C) Section C text.", "questionNumber": 36, "questionType": "글의 순서", "underlinedText": "" }, "choices": ["① (A)-(C)-(B)", "② (B)-(A)-(C)", "③ (B)-(C)-(A)", "④ (C)-(A)-(B)", "⑤ (C)-(B)-(A)"] } },
    { "type": "summary", "data": { "title": "오늘 배운 내용 정리", "items": ["한국어 요약1", "한국어 요약2"] } },
    { "type": "micro-feedback", "data": { "title": "오늘 수업 되돌아보기", "items": ["오늘 배운 내용 중 기억에 남는 것은?", "어려웠던 부분은 무엇인가요?", "이해도를 스스로 평가해보세요 (⭐~⭐⭐⭐⭐⭐)"] } }
  ]
}

RULES:
1. "type" field is MANDATORY
2. objectives → KOREAN, "~할 수 있다" form, 3~4 items
3. passage "questionType" → copy EXACTLY from analysis. Valid values:
   "빈칸 추론" / "글의 순서" / "흐름과 무관한 문장" / "주제" / "요지" / "제목" / "심경" / "어법성 판단" / "어휘 적절성" / "알맞은 표현(어법)"
   CRITICAL: "어휘 적절성" = vocabulary wrong in context ("문맥상 낱말의 쓰임이 적절하지 않은 것은?")
             "어법성 판단" = grammar wrong ("어법상 틀린 것은?")
             DO NOT confuse these two — read the question text carefully.
4. passage "questionNumber" → integer from analysis (e.g. 29)
5. passage "text" → copy EXACTLY from analysis including all special characters ①②③④⑤ ____ (A)(B)(C)
6. passage "choices" → ALWAYS a flat array of 5 plain strings. NEVER use JSON objects or nested arrays inside choices.
   - 어법성 판단: ["①", "②", "③", "④", "⑤"]
   - 글의 순서: ["① (A)-(C)-(B)", "② (B)-(A)-(C)", "③ (B)-(C)-(A)", "④ (C)-(A)-(B)", "⑤ (C)-(B)-(A)"]
   - 알맞은 표현(어법): MUST be 5 plain strings, each a full row combination: "① [A] - [B] - [C]". Example: ["① satisfied - their - because", "② satisfied - whose - because of", "③ to satisfy - their - because", "④ to satisfy - whose - because of", "⑤ to satisfy - their - because of"]. NEVER use {"A":[...]} JSON format.
   - others: exact choice text strings from analysis (e.g. "① to save money", "② to make friends")
7. passage "underlinedText" → exact underlined phrase if any, else ""
8. One passage slide per passage — include ALL
9. DO NOT include vocabulary/ox-quiz/ox-answer slides`,
  });

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content: 'You are an English lesson slide creator. Return ONLY valid JSON. Every slide MUST have "type" field. No markdown, no extra text.',
      },
      { role: 'user', content },
    ],
    max_tokens: 8000,
  });

  const text = response.choices[0].message.content || '';

  // JSON 추출 (마크다운 코드블록 포함 처리)
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    const braceStart = text.indexOf('{');
    if (braceStart >= 0) jsonStr = text.slice(braceStart);
  }

  if (!jsonStr) throw new Error('슬라이드 생성 실패: AI 응답에서 JSON을 찾을 수 없습니다.');

  // 잘린 JSON 복구 함수 — 브라켓 균형 맞추기
  function recoverJSON(s: string): any {
    // 1) 직접 파싱 시도
    try { return JSON.parse(s); } catch {}

    // 2) 브라켓 균형 복구: 열린 문자열/괄호를 추적해서 닫기
    function balanceAndParse(raw: string): any {
      let result = raw;

      // 2a) 미완성 문자열 찾기: 마지막 열린 " 뒤를 제거
      let inString = false;
      let escaped = false;
      let lastStringStart = -1;
      for (let i = 0; i < result.length; i++) {
        if (escaped) { escaped = false; continue; }
        if (result[i] === '\\' && inString) { escaped = true; continue; }
        if (result[i] === '"') {
          if (inString) { inString = false; lastStringStart = -1; }
          else { inString = true; lastStringStart = i; }
        }
      }
      if (inString && lastStringStart >= 0) {
        result = result.slice(0, lastStringStart);
      }

      // 2b) 끝의 쉼표 제거
      result = result.replace(/,\s*$/, '');

      // 2c) 열린 {[ 개수 세어서 닫기
      let braces = 0, brackets = 0;
      inString = false; escaped = false;
      for (const c of result) {
        if (escaped) { escaped = false; continue; }
        if (c === '\\' && inString) { escaped = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (!inString) {
          if (c === '{') braces++;
          else if (c === '}') braces--;
          else if (c === '[') brackets++;
          else if (c === ']') brackets--;
        }
      }
      for (let i = 0; i < brackets; i++) result += ']';
      for (let i = 0; i < braces; i++) result += '}';

      return JSON.parse(result);
    }

    // 3) 전체 문자열로 균형 복구 시도
    try { return balanceAndParse(s); } catch {}

    // 4) 마지막 완성된 슬라이드 경계에서 잘라낸 뒤 복구
    //    "type" 키가 등장하는 마지막 위치 이전의 },  를 찾아서 거기서 자르기
    const lastTypeIdx = s.lastIndexOf('"type"');
    if (lastTypeIdx > 0) {
      const cutPoint = s.lastIndexOf('},', lastTypeIdx);
      if (cutPoint > 0) {
        try { return balanceAndParse(s.slice(0, cutPoint + 1)); } catch {}
      }
    }

    // 5) 마지막 }}, 또는 }} 앞까지 잘라서 복구
    const lastDblClose = s.lastIndexOf('}}');
    if (lastDblClose > 0) {
      try { return balanceAndParse(s.slice(0, lastDblClose + 2)); } catch {}
    }

    throw new Error('슬라이드 생성 실패: JSON 파싱 오류');
  }

  let parsed: any;
  try {
    parsed = recoverJSON(jsonStr);
  } catch (e: any) {
    // 디버그: 실제 응답 끝부분 로그
    console.error('=== JSON 파싱 실패 디버그 ===');
    console.error('응답 전체 길이:', jsonStr.length);
    console.error('응답 마지막 300자:', jsonStr.slice(-300));
    console.error('응답 처음 200자:', jsonStr.slice(0, 200));
    throw new Error(e?.message || '슬라이드 생성 실패: JSON 파싱 오류');
  }

  if (!parsed?.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error('슬라이드 생성 실패: 슬라이드 데이터가 없습니다.');
  }

  return parsed.slides.map((s: any, i: number) => {
    // data가 별도 키로 있으면 사용, 없으면 top-level 필드 사용
    const data = s.data && typeof s.data === 'object' && Object.keys(s.data).length > 0
      ? s.data
      : (() => {
          const { type: _t, order: _o, layout: _l, id: _i, ...rest } = s;
          return rest;
        })();

    // type 추론 (AI가 빠뜨릴 경우 대비)
    const resolvedType = inferType(s);

    return {
      id: `slide-${i}`,
      projectId: '',
      order: s.order || i + 1,
      type: resolvedType,
      layout: s.layout || 'title-content',
      data,
      approved: false,
    };
  });
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
