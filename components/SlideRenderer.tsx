import type { SlideItem } from '@/lib/types';
import BgRemovedImage from './BgRemovedImage';

interface SlideRendererProps {
  slide: SlideItem;
  scale?: number;
  contiType?: string;
}

// 커버: 가로형 1080×600 / 지문: 세로형 600×1120 / 내신대비 지문: 가로형 1080×700 / 나머지: 세로형 600×840
export const COVER_W = 1080;
export const COVER_H = 600;
export const SLIDE_W = 600;
export const SLIDE_H = 840;
export const PASSAGE_H = 1120;
export const NAESHIN_W = 780;
export const NAESHIN_H = 700;

// AI 응답이 객체로 올 수 있으므로 안전하게 문자열 변환
function str(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.content || val.text || val.word || val.meaning || val.statement || JSON.stringify(val);
  }
  return String(val);
}

function safeItems(items: any): string[] {
  if (!Array.isArray(items)) return [];
  return items.map(str);
}

export default function SlideRenderer({ slide, scale = 1, contiType }: SlideRendererProps) {
  const isNaeshin = contiType === '내신대비용';
  const { type, data } = slide;
  const isCover = type === 'cover';
  const isPassage = type === 'passage';
  const isWide = type === 'feedback' || type === 'assignment-feedback' || type === 'common-qa';

  const isNaeshinPassage = isPassage && contiType === '내신대비용';
  const W = (isCover || isWide || isNaeshinPassage) ? (isNaeshinPassage ? NAESHIN_W : COVER_W) : SLIDE_W;
  const H = (isCover || isWide) ? COVER_H : isNaeshinPassage ? NAESHIN_H : isPassage ? PASSAGE_H : SLIDE_H;

  const baseStyle: React.CSSProperties = {
    width: W,
    height: H,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  };

  /* ── COVER (가로형 1080×600) ── */
  if (type === 'cover') {
    return (
      <div style={{ ...baseStyle, background: 'linear-gradient(135deg, #0f0f0f 0%, #1e0e00 50%, #0f0f0f 100%)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #F97316, #fb923c)' }} />
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(249,115,22,0.07)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(249,115,22,0.04)' }} />
        <div style={{ position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)', width: 5, height: 160, background: '#F97316', borderRadius: 3 }} />

        {/* 우측 사진 영역 — 배경 자동 제거 */}
        <div style={{ position: 'absolute', right: 40, top: 'calc(50% - 160px)', width: 320 }}>
          <BgRemovedImage
            src="/cover-photo.png"
            tolerance={40}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* 좌측 텍스트 영역 */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 440px 60px 90px' }}>
          <p style={{ fontSize: data.subtitleSize || 28, color: data.subtitleColor || '#FBBF24', fontWeight: 700, letterSpacing: 2, marginBottom: 14 }}>
            {str(data.subtitle) || 'English Class'}
          </p>
          <h1 style={{ fontSize: data.titleSize || 44, fontWeight: 900, color: data.titleColor || '#fff', lineHeight: 1.15, marginBottom: 18 }}>
            {str(data.title)}
          </h1>
          {/* 반명 / 수업요일 태그 */}
          {((data as any).className || (data as any).classDay) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {(data as any).className && (
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(249,115,22,0.18)',
                  color: '#F97316',
                  border: '1px solid rgba(249,115,22,0.4)',
                }}>
                  🏫 {(data as any).className}
                </span>
              )}
              {(data as any).classDay && (
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(251,191,36,0.15)',
                  color: '#FBBF24',
                  border: '1px solid rgba(251,191,36,0.35)',
                }}>
                  📅 {(data as any).classDay}
                </span>
              )}
            </div>
          )}
          {/* 제목 하단 추가 내용 */}
          {data.content && (
            <p style={{ fontSize: 15, color: '#bbb', lineHeight: 1.7, marginBottom: data.items ? 12 : 0 }}>
              {str(data.content)}
            </p>
          )}
          {Array.isArray(data.items) && data.items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: data.content ? 0 : 4 }}>
              {safeItems(data.items).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#bbb', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #F97316, transparent)' }} />
      </div>
    );
  }

  /* ── FEEDBACK (커버와 동일한 840×600 가로형) ── */
  if (type === 'feedback') {
    return (
      <div style={{ ...baseStyle, background: 'linear-gradient(135deg, #0d0d1a 0%, #12082a 50%, #0d0d1a 100%)' }}>
        {/* 상단 그라데이션 바 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)' }} />
        {/* 배경 장식 원 */}
        <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'rgba(99,102,241,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(168,85,247,0.06)' }} />
        {/* 왼쪽 세로 강조선 */}
        <div style={{ position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)', width: 5, height: 160, background: 'linear-gradient(180deg,#6366f1,#a855f7)', borderRadius: 3 }} />

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 80px 60px 90px' }}>
          <p style={{ fontSize: 13, color: '#a855f7', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 18 }}>
            Warm-up Activity
          </p>
          <h1 style={{ fontSize: 64, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20, letterSpacing: -1 }}>
            Micro<br />Feedback
          </h1>
          <p style={{ fontSize: 16, color: '#666', lineHeight: 1.6 }}>
            Think back & share your thoughts
          </p>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #6366f1, transparent)' }} />
      </div>
    );
  }

  /* ── ASSIGNMENT FEEDBACK (과제 피드백) — 가로형 1080×600, 제목만 ── */
  if (type === 'assignment-feedback') {
    return (
      <div style={{ ...baseStyle, background: 'linear-gradient(135deg, #1a0e00 0%, #2d1800 50%, #1a0e00 100%)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
        <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'rgba(245,158,11,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(251,191,36,0.05)' }} />
        <div style={{ position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)', width: 5, height: 160, background: 'linear-gradient(180deg,#f59e0b,#fbbf24)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 80px 60px 90px' }}>
          <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 18 }}>
            Homework Review
          </p>
          <h1 style={{ fontSize: 64, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20, letterSpacing: -1 }}>
            {str(data.title) || '과제 피드백'}
          </h1>
          <p style={{ fontSize: 16, color: '#666', lineHeight: 1.6 }}>
            Check your homework & learn from mistakes
          </p>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
      </div>
    );
  }

  /* ── COMMON QA (공통질문 풀이) — 가로형 1080×600, 제목만 ── */
  if (type === 'common-qa') {
    return (
      <div style={{ ...baseStyle, background: 'linear-gradient(135deg, #001a0e 0%, #00281a 50%, #001a0e 100%)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
        <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'rgba(16,185,129,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(52,211,153,0.05)' }} />
        <div style={{ position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)', width: 5, height: 160, background: 'linear-gradient(180deg,#10b981,#34d399)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '36px 80px 36px 90px' }}>
          <p style={{ fontSize: 12, color: '#10b981', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
            Common Questions
          </p>
          <h1 style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 10, letterSpacing: -0.5 }}>
            {str(data.title) || '공통질문 풀이'}
          </h1>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
            Let's solve your questions together
          </p>
          {/* 지문 캡처 붙이는 공간 */}
          <div style={{
            flex: 1,
            marginTop: 18,
            borderRadius: 10,
            border: '1.5px dashed #1e4d35',
            background: 'rgba(16,185,129,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 12, color: '#2a5c42', fontWeight: 500 }}>지문 캡처 영역</span>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #10b981, transparent)' }} />
      </div>
    );
  }

  /* ── OBJECTIVES ── */
  if (type === 'objectives') {
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#F97316' }} />
        <div style={{ padding: '44px 40px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{ width: 4, height: 30, background: '#F97316', borderRadius: 2 }} />
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>학습 목표</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            {safeItems(data.items).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', background: '#242424', borderRadius: 10, border: '1px solid #333' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#F97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 15, color: '#e5e5e5', lineHeight: 1.65, paddingTop: 3 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── VOCABULARY (2열, 텍스트 자르지 않음) ── */
  if (type === 'vocabulary') {
    const vocab = Array.isArray(data.vocabulary) ? data.vocabulary : [];

    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#F97316' }} />
        <div style={{ padding: '24px 24px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexShrink: 0 }}>
            <div style={{ width: 4, height: 26, background: '#F97316', borderRadius: 2 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{str(data.title) || 'Key Vocabulary'}</h2>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#555', fontWeight: 500 }}>{vocab.length} words</span>
          </div>
          {/* 2열 그리드 — 행 높이 균등 분배 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: `repeat(${Math.ceil(Math.min(vocab.length, 16) / 2)}, 1fr)`,
            gap: 8,
            flex: 1,
          }}>
            {vocab.slice(0, 16).map((v: any, i: number) => (
              <div key={i} style={{
                padding: '10px 13px',
                background: '#242424',
                borderRadius: 8,
                border: '1px solid #2e2e2e',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 5,
                boxSizing: 'border-box',
                minHeight: 0,
              }}>
                {/* 단어 + 뜻 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#F97316',
                    flexShrink: 0,
                  }}>{str(v.word ?? v)}</span>
                  <span style={{
                    fontSize: 13,
                    color: '#ccc',
                    flexShrink: 0,
                  }}>{str(v.meaning)}</span>
                </div>
                {/* 예문 */}
                {v.example && (
                  <span style={{
                    fontSize: 11,
                    color: '#666',
                    fontStyle: 'italic',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}>{str(v.example)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── PASSAGE (600×1120, 좌우 대칭, 보기 포함) ── */
  if (type === 'passage') {
    const passageText = str(data.passage?.text ?? (data as any).passage);
    const choices: string[] = Array.isArray((data as any).choices) ? (data as any).choices : [];
    const qNum = data.passage?.questionNumber ?? (data as any).questionNumber ?? null;
    const qType = data.passage?.questionType || (data as any).questionType || '';
    const underlinedText: string = str(data.passage?.underlinedText ?? (data as any).underlinedText ?? '');

    // 문제 유형 감지
    const isOrdering = /순서|order/i.test(qType);
    const isGrammarJudge = /어법성|어법 판단|어법상/i.test(qType);
    const isVocabJudge = /어휘 적절성|어휘적절|문맥상.*어휘|낱말.*적절/i.test(qType);
    const isSentenceInsert = /문장 삽입|문장삽입|삽입/i.test(qType);
    const isSummary = /요약문|요약/i.test(qType);
    const isHinted = /함의|목적|주장|심경|요지|주제|제목|지칭/i.test(qType);
    // 어휘 적절성도 ①②③④⑤ 인라인 형식 동일
    const isInlineCircle = isGrammarJudge || isVocabJudge;

    // 어법성판단: PDF 파싱으로 생긴 ____ 빈칸 제거 (방어 처리)
    const cleanedPassageText = isInlineCircle
      ? passageText.replace(/_{2,}/g, '').replace(/\s{2,}/g, ' ').trim()
      : passageText;

    // 순서 배열: 제시문(인트로) + (A)(B)(C) 섹션 분리
    let introText = '';
    const abcSections: { label: string; text: string }[] = [];
    if (isOrdering) {
      const abcRegex = /\(([ABC])\)\s*/g;
      const firstMatch = abcRegex.exec(passageText);
      if (firstMatch) {
        introText = passageText.slice(0, firstMatch.index).trim();
        const remaining = passageText.slice(firstMatch.index);
        const parts = remaining.split(/(?=\([ABC]\)\s*)/);
        parts.forEach((part) => {
          const m = part.match(/^\(([ABC])\)\s*([\s\S]*)/);
          if (m) abcSections.push({ label: m[1], text: m[2].trim() });
        });
      } else {
        introText = passageText;
      }
    }

    const passageFont: React.CSSProperties = {
      fontFamily: 'Georgia, "Times New Roman", "Noto Serif", serif',
      letterSpacing: '0.01em',
    };

    // 밑줄 친 부분을 강조 표시하는 함수 (underlinedText가 있을 때 사용)
    const renderWithUnderline = (text: string, underline: string) => {
      if (!underline || !text.includes(underline)) return <>{text}</>;
      const idx = text.indexOf(underline);
      const before = text.slice(0, idx);
      const after = text.slice(idx + underline.length);
      return (
        <>
          {before}
          <span style={{
            textDecoration: 'underline',
            textDecorationColor: '#facc15',
            textDecorationThickness: 2,
            color: '#fff',
            fontWeight: 600,
          }}>{underline}</span>
          {after}
        </>
      );
    };

    // 어법성판단: ① 뒤에 오는 단어/구를 밑줄로 강조
    // 패턴: "... ① 단어(들) ..." → 번호 뒤 단어/구에 노란 밑줄
    const renderGrammarJudgeText = (text: string) => {
      const circlePattern = /(①|②|③|④|⑤)/g;
      const parts = text.split(circlePattern);
      const result: React.ReactNode[] = [];

      parts.forEach((part, i) => {
        if (['①','②','③','④','⑤'].includes(part)) {
          result.push(
            <span key={`num-${i}`} style={{
              color: '#F97316', fontWeight: 800, fontSize: 15,
              background: 'rgba(249,115,22,0.18)', borderRadius: 3, padding: '0 3px',
              margin: '0 1px',
            }}>{part}</span>
          );
        } else {
          const prevIsNum = ['①','②','③','④','⑤'].includes(parts[i - 1] ?? '');
          if (prevIsNum && part.trim()) {
            // 번호 바로 뒤 단어/구에 밑줄 (최대 2단어, 스톱워드에서 중단)
            // 스톱워드: 두 번째 단어가 이것이면 첫 단어만 밑줄
            const stopWords = /^(to|a|an|the|I|he|she|it|we|they|one|this|that|those|these|something|someone|there|here|very|quite|solely|only|just|more|most|less|least|much|many|few|some|any|all|no|not)$/i;
            const w = part.match(/^(\s*)([\w'"\-]+)(?:\s+([\w'"\-]+))?([\s\S]*)$/);
            if (w) {
              let underlined = w[2];
              let trailing = '';
              if (w[3] && !stopWords.test(w[3])) {
                // 두 번째 단어가 스톱워드 아니면 포함
                underlined += ' ' + w[3];
                trailing = w[4] ?? '';
              } else {
                trailing = (w[3] ? ' ' + w[3] : '') + (w[4] ?? '');
              }
              if (w[1]) result.push(<span key={`sp-${i}`}>{w[1]}</span>);
              result.push(
                <span key={`ul-${i}`} style={{
                  textDecoration: 'underline',
                  textDecorationColor: '#facc15',
                  textDecorationThickness: 2,
                  color: '#fff',
                }}>{underlined}</span>
              );
              result.push(<span key={`rest-${i}`}>{trailing}</span>);
            } else {
              result.push(<span key={`plain-${i}`}>{part}</span>);
            }
          } else {
            result.push(<span key={`plain-${i}`}>{part}</span>);
          }
        }
      });

      return <>{result}</>;
    };

    // JSON 보기를 {key: vals[]} 맵으로 파싱 시도
    const tryParseAbcMap = (raw: string): Record<string, string[]> | null => {
      const t = raw.replace(/^[①②③④⑤]\s*/, '').trim();
      if (t.startsWith('{')) {
        try { return JSON.parse(t) as Record<string, string[]>; } catch { /* */ }
      }
      return null;
    };

    // 보기 배열이 {"A":[...]} {"B":[...]} {"C":[...]} 컬럼 형태인지 감지
    const abcMaps = choices.map((c) => tryParseAbcMap(str(c)));
    const isAbcColumnFormat = abcMaps.every((m) => m !== null) && abcMaps.length >= 2;

    // 알맞은표현(어법) ABC 컬럼 테이블 렌더러
    const circleNums5 = ['①','②','③','④','⑤'];
    const abcTableBlock = isAbcColumnFormat ? (() => {
      const cols = abcMaps.map((m) => {
        const entries = Object.entries(m!);
        return { key: entries[0][0], opts: (entries[0][1] as string[]).map((v: string) => v.replace(/^[①②③④⑤]\s*/, '')) };
      });
      // 행 수 = A컬럼 기준 (보통 5개)
      const rowCount = Math.max(...cols.map((c) => c.opts.length), 5);
      return (
        <div style={{ flexShrink: 0, padding: '8px 10px', background: '#1e1e1e', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          {/* 헤더 행 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: 4, paddingBottom: 5 }}>
            <div style={{ width: 28, flexShrink: 0 }} />
            {cols.map((col) => (
              <div key={col.key} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#F97316', ...passageFont }}>
                ({col.key})
              </div>
            ))}
          </div>
          {/* 데이터 행 ①②③④⑤ */}
          {Array.from({ length: rowCount }).map((_, rowIdx) => (
            <div key={rowIdx} style={{
              display: 'flex', alignItems: 'center', padding: '3px 0',
              borderBottom: rowIdx < rowCount - 1 ? '1px solid #2a2a2a' : 'none',
            }}>
              {/* 행 번호 */}
              <div style={{ width: 28, flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#F97316', textAlign: 'center', ...passageFont }}>
                {circleNums5[rowIdx] ?? ''}
              </div>
              {cols.map((col) => {
                // 짧은 컬럼은 순환(cycle)해서 5행 채우기
                const val = col.opts.length > 0 ? col.opts[rowIdx % col.opts.length] : '';
                return (
                  <div key={col.key} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#ccc', lineHeight: 1.5, ...passageFont }}>
                    {val}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    })() : null;

    // 일반 보기 텍스트 정리
    const cleanChoice = (raw: string): string => raw.replace(/^[①②③④⑤]\s*/, '').trim();

    // 보기 블록: 어법성판단이면 가로 나열, ABC컬럼이면 테이블, 일반이면 세로 목록
    const choicesBlock = choices.length > 0 ? (
      isInlineCircle ? (
        // 어법성판단: ①②③④⑤를 가로로 나열 (단순 번호 선택지)
        <div style={{ flexShrink: 0, padding: '10px 20px', background: '#1e1e1e', borderRadius: 10, border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#666', marginRight: 8 }}>정답 선택지:</span>
          {['①','②','③','④','⑤'].map((num, i) => (
            <span key={i} style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#F97316',
              width: 36, height: 36,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(249,115,22,0.12)',
              border: '1.5px solid rgba(249,115,22,0.4)',
              borderRadius: '50%',
              ...passageFont,
            }}>{num}</span>
          ))}
        </div>
      ) : isAbcColumnFormat ? abcTableBlock : (
        // 일반: 세로 목록
        <div style={{ flexShrink: 0, padding: '10px 14px', background: '#1e1e1e', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {choices.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#F97316', fontWeight: 700, flexShrink: 0, minWidth: 18, ...passageFont }}>
                  {['①','②','③','④','⑤'][i] || `${i+1}`}
                </span>
                <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.55, ...passageFont }}>
                  {cleanChoice(str(c))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    ) : null;

    // 내신대비: 글자 크기 자동 조정 (지문 길이 기준)
    const textLen = cleanedPassageText.length || passageText.length;
    // 가로형(1080×700)이므로 더 큰 폰트, 넉넉한 줄 간격
    const naeshinFontSize = textLen < 400 ? 20 : textLen < 650 ? 17 : textLen < 900 ? 15 : 13;
    const naeshinLineHeight = textLen < 400 ? 2.8 : textLen < 650 ? 2.6 : textLen < 900 ? 2.4 : 2.2;

    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#F97316' }} />
        <div style={{ padding: isNaeshin ? '20px 32px' : '28px 44px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', gap: isNaeshin ? 8 : 12 }}>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 5, height: 26, background: '#F97316', borderRadius: 2 }} />
            <h2 style={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>{str(data.title) || 'Reading Passage'}</h2>
            {qNum && <span style={{ fontSize: 11, background: 'rgba(249,115,22,0.15)', color: '#F97316', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(249,115,22,0.3)', fontWeight: 600 }}>{qNum}번</span>}
            {qType && <span style={{ fontSize: 10, color: '#888', background: '#242424', padding: '2px 8px', borderRadius: 10, border: '1px solid #333' }}>{qType}</span>}
          </div>

          {isOrdering ? (
            /* ── 순서 배열: 제시문 박스 + (A)(B)(C) 섹션 + 보기 ── */
            <>
              {/* 제시문 박스 */}
              {introText && (
                <div style={{ flexShrink: 0, padding: '14px 20px', background: '#242424', borderRadius: 10, border: '2px solid rgba(249,115,22,0.5)', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.9, textAlign: 'justify', wordBreak: 'break-word', ...passageFont }}>
                    {introText}
                  </div>
                </div>
              )}
              {/* (A)(B)(C) 섹션 */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {abcSections.map(({ label, text }) => (
                  <div key={label} style={{ padding: '12px 16px', background: '#242424', borderRadius: 9, border: '1px solid #333', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#F97316', flexShrink: 0, ...passageFont }}>({label})</span>
                    <span style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.85, textAlign: 'justify', wordBreak: 'break-word', ...passageFont }}>{text}</span>
                  </div>
                ))}
              </div>
              {/* 보기: ABC 섹션 바로 아래 */}
              {choicesBlock}
            </>
          ) : (
            /* ── 일반 지문: 지문 + 보기를 하나의 flex 컨테이너에 묶어 보기가 지문 바로 아래 오도록 ── */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isNaeshin ? 0 : 10, overflow: 'hidden' }}>
              <div style={{
                flex: isNaeshin ? 1 : undefined,
                flexShrink: isNaeshin ? undefined : 0,
                padding: isNaeshin ? '16px 20px' : '20px 32px',
                background: '#242424',
                borderRadius: 12,
                border: isNaeshin ? '1px solid #333' : isInlineCircle ? '1.5px solid rgba(249,115,22,0.35)' : '1px solid #333',
                boxSizing: 'border-box',
              }}>
                {!isNaeshin && isGrammarJudge && (
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontStyle: 'italic' }}>
                    ※ 밑줄 친 부분 중, 어법상 <span style={{ color: '#F97316', fontWeight: 600 }}>틀린</span> 것은?
                  </div>
                )}
                {!isNaeshin && isVocabJudge && (
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontStyle: 'italic' }}>
                    ※ 밑줄 친 낱말 중, 문맥상 낱말의 쓰임이 <span style={{ color: '#F97316', fontWeight: 600 }}>적절하지 않은</span> 것은?
                  </div>
                )}
                {!isNaeshin && isSentenceInsert && underlinedText && (
                  <div style={{ fontSize: 12, color: '#FBBF24', marginBottom: 10, padding: '6px 10px', background: 'rgba(251,191,36,0.1)', borderRadius: 6, border: '1px solid rgba(251,191,36,0.3)' }}>
                    💬 주어진 문장: <span style={{ fontStyle: 'italic', color: '#fff' }}>{underlinedText}</span>
                  </div>
                )}
                {!isNaeshin && isSummary && (
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontStyle: 'italic' }}>
                    ※ 빈칸 <span style={{ color: '#F97316', fontWeight: 600 }}>(A)</span>, <span style={{ color: '#F97316', fontWeight: 600 }}>(B)</span>에 들어갈 말을 고르세요
                  </div>
                )}
                {!isNaeshin && isHinted && underlinedText && (
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontStyle: 'italic' }}>
                    ※ 밑줄 친 <span style={{ color: '#facc15', fontWeight: 600 }}>"{underlinedText}"</span>의 의미로 가장 적절한 것은?
                  </div>
                )}
                {!isNaeshin && !isInlineCircle && !isSentenceInsert && !isSummary && !isHinted && underlinedText && (
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontStyle: 'italic' }}>
                    ※ <span style={{ color: '#facc15', fontWeight: 600 }}>밑줄 친</span> 부분에 유의하세요
                  </div>
                )}
                <div style={{
                  fontSize: isNaeshin ? naeshinFontSize : 14,
                  color: '#e0e0e0',
                  lineHeight: isNaeshin ? naeshinLineHeight : 2.0,
                  whiteSpace: 'pre-wrap',
                  textAlign: 'justify',
                  wordBreak: 'break-word',
                  ...passageFont,
                }}>
                  {isInlineCircle
                    ? renderGrammarJudgeText(cleanedPassageText)
                    : underlinedText
                      ? renderWithUnderline(passageText, underlinedText)
                      : passageText}
                </div>
                {data.passage?.source && (
                  <p style={{ fontSize: 11, color: '#555', marginTop: 10, textAlign: 'right' }}>— {str(data.passage.source)}</p>
                )}
              </div>
              {/* 보기: 내신대비 모드에서는 숨김 */}
              {!isNaeshin && choicesBlock}
            </div>
          )}

        </div>
      </div>
    );
  }

  /* ── GRAMMAR QUIZ (둘 중 하나 선택) ── */
  if (type === 'grammar-quiz') {
    const gqs = Array.isArray((data as any).grammarQuestions) ? (data as any).grammarQuestions : [];
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }} />
        <div style={{ padding: '32px 30px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 4, height: 26, background: '#3b82f6', borderRadius: 2 }} />
            <h2 style={{ fontSize: 21, fontWeight: 700, color: '#fff' }}>{str(data.title) || '어법 퀴즈'}</h2>
            <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 10px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.3)' }}>어법</span>
          </div>
          {/* 문제 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
            {gqs.map((q: any, i: number) => {
              const sentence: string = str(q.sentence ?? '');
              // (A / B) 패턴을 시각적으로 강조
              const parts = sentence.split(/(\([^)]+\s*\/\s*[^)]+\))/);
              return (
                <div key={i} style={{
                  padding: '11px 14px',
                  background: '#242424',
                  borderRadius: 9,
                  border: '1px solid #333',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}>
                  {/* 번호 */}
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    border: '1px solid rgba(59,130,246,0.4)',
                    marginTop: 1,
                  }}>
                    {q.number ?? i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    {/* 문법 유형 태그 */}
                    {q.grammarType && (
                      <span style={{ fontSize: 10, color: '#06b6d4', background: 'rgba(6,182,212,0.1)', padding: '1px 7px', borderRadius: 4, border: '1px solid rgba(6,182,212,0.25)', marginBottom: 5, display: 'inline-block' }}>
                        {str(q.grammarType)}
                      </span>
                    )}
                    {/* 문장 (A / B 부분 강조) */}
                    <p style={{ fontSize: 13, color: '#e5e5e5', lineHeight: 1.7 }}>
                      {parts.map((part, pi) =>
                        pi % 2 === 0
                          ? <span key={pi}>{part}</span>
                          : <span key={pi} style={{ color: '#60a5fa', fontWeight: 700, background: 'rgba(59,130,246,0.12)', padding: '0 4px', borderRadius: 4 }}>{part}</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── GRAMMAR ANSWER (어법 퀴즈 정답지) ── */
  if (type === 'grammar-answer') {
    const gqs = Array.isArray((data as any).grammarQuestions) ? (data as any).grammarQuestions : [];
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#0ea5e9,#22d3ee)' }} />
        <div style={{ padding: '32px 30px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 4, height: 26, background: '#0ea5e9', borderRadius: 2 }} />
            <h2 style={{ fontSize: 21, fontWeight: 700, color: '#fff' }}>{str(data.title) || '어법 퀴즈 — 정답 확인'}</h2>
            <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(14,165,233,0.15)', color: '#38bdf8', padding: '2px 10px', borderRadius: 20, border: '1px solid rgba(14,165,233,0.3)' }}>정답지</span>
          </div>
          {/* 정답 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
            {gqs.map((q: any, i: number) => {
              const answerIsA = str(q.answer) === 'A';
              const correct = answerIsA ? str(q.optionA) : str(q.optionB);
              const wrong   = answerIsA ? str(q.optionB) : str(q.optionA);
              const sentence: string = str(q.sentence ?? '');
              // (A / B) 부분을 정답/오답으로 대체하여 강조
              const parts = sentence.split(/(\([^)]+\s*\/\s*[^)]+\))/);
              return (
                <div key={i} style={{
                  padding: '10px 14px',
                  background: '#242424',
                  borderRadius: 9,
                  border: '1px solid rgba(34,197,94,0.2)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}>
                  {/* 정답 배지 */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginTop: 1 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#22c55e',
                      background: 'rgba(34,197,94,0.15)', padding: '2px 7px',
                      borderRadius: 5, border: '1px solid rgba(34,197,94,0.35)',
                      whiteSpace: 'nowrap',
                    }}>
                      ✓ {correct}
                    </span>
                    <span style={{
                      fontSize: 10, color: '#555',
                      textDecoration: 'line-through', whiteSpace: 'nowrap',
                    }}>
                      {wrong}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {q.grammarType && (
                      <span style={{ fontSize: 10, color: '#06b6d4', background: 'rgba(6,182,212,0.1)', padding: '1px 7px', borderRadius: 4, border: '1px solid rgba(6,182,212,0.25)', marginBottom: 4, display: 'inline-block' }}>
                        {str(q.grammarType)}
                      </span>
                    )}
                    <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>
                      {parts.map((part, pi) => {
                        if (pi % 2 === 0) return <span key={pi}>{part}</span>;
                        return (
                          <span key={pi}>
                            (<span style={{ color: '#4ade80', fontWeight: 700 }}>{correct}</span>
                            {' / '}
                            <span style={{ color: '#555', textDecoration: 'line-through' }}>{wrong}</span>)
                          </span>
                        );
                      })}
                    </p>
                    {q.explanation && (
                      <p style={{ fontSize: 11, color: '#60a5fa', lineHeight: 1.5, marginTop: 5, paddingTop: 5, borderTop: '1px solid #2a2a2a' }}>
                        💡 {str(q.explanation)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── GRAMMAR ── */
  if (type === 'grammar') {
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#F97316' }} />
        <div style={{ padding: '36px 32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 4, height: 26, background: '#F97316', borderRadius: 2 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{str(data.title) || 'Grammar'}</h2>
          </div>
          {data.content && (
            <div style={{ marginBottom: 18, padding: '14px 18px', background: 'rgba(249,115,22,0.1)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.3)' }}>
              <p style={{ fontSize: 15, color: '#F97316', fontWeight: 600 }}>{str(data.content)}</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {safeItems(data.items).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px', background: '#242424', borderRadius: 7, border: '1px solid #333' }}>
                <span style={{ color: '#F97316', fontWeight: 700, flexShrink: 0 }}>▶</span>
                <span style={{ fontSize: 13, color: '#e5e5e5', lineHeight: 1.7 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── EXERCISE ── */
  if (type === 'exercise') {
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#F97316' }} />
        <div style={{ padding: '36px 32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 4, height: 26, background: '#F97316', borderRadius: 2 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{str(data.title) || 'Exercises'}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {(data.questions || []).map((q: any, qi: number) => (
              <div key={qi} style={{ padding: '12px 16px', background: '#242424', borderRadius: 8, border: '1px solid #333' }}>
                <p style={{ fontSize: 13, color: '#e5e5e5', fontWeight: 600, lineHeight: 1.6, marginBottom: q.options ? 8 : 0 }}>
                  {q.number ?? qi + 1}. {str(q.question)}
                </p>
                {q.options && Array.isArray(q.options) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {q.options.map((opt: any, oi: number) => (
                      <span key={oi} style={{ fontSize: 12, color: '#aaa', paddingLeft: 8 }}>
                        {String.fromCharCode(9312 + oi)} {str(opt)}
                      </span>
                    ))}
                  </div>
                )}
                {q.answer && (
                  <p style={{ fontSize: 11, color: '#22c55e', marginTop: 6, paddingTop: 6, borderTop: '1px solid #333' }}>Answer: {str(q.answer)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── OX QUIZ (문제만 — 답 없음) ── */
  if (type === 'ox-quiz') {
    const oxQs = Array.isArray((data as any).oxQuestions) ? (data as any).oxQuestions : [];
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#a855f7' }} />
        <div style={{ padding: '36px 32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ width: 4, height: 26, background: '#a855f7', borderRadius: 2 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{str(data.title) || '내용 확인 (O/X)'}</h2>
            <span style={{ marginLeft: 8, fontSize: 12, background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '2px 10px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.3)' }}>O / X</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
            {oxQs.map((q: any, i: number) => (
              <div key={i} style={{
                padding: '14px 18px',
                background: '#242424',
                borderRadius: 9,
                border: '1px solid #333',
                display: 'flex',
                gap: 14,
                alignItems: 'center',
              }}>
                {/* 번호 */}
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(168,85,247,0.2)', color: '#a855f7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  border: '1px solid rgba(168,85,247,0.4)',
                }}>
                  {q.number ?? i + 1}
                </span>
                <p style={{ fontSize: 14, color: '#e5e5e5', lineHeight: 1.55, flex: 1 }}>{str(q.statement ?? q.question)}</p>
                {/* 빈 O/X 버튼 */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 6, border: '2px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'rgba(34,197,94,0.4)' }}>O</span>
                  <span style={{ width: 32, height: 32, borderRadius: 6, border: '2px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'rgba(239,68,68,0.4)' }}>X</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── OX ANSWER (답지) ── */
  if (type === 'ox-answer') {
    const oxQs = Array.isArray((data as any).oxQuestions) ? (data as any).oxQuestions : [];
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#f59e0b' }} />
        <div style={{ padding: '36px 32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ width: 4, height: 26, background: '#f59e0b', borderRadius: 2 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{str(data.title) || '정답 확인'}</h2>
            <span style={{ marginLeft: 8, fontSize: 12, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 10px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.3)' }}>정답지</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {oxQs.map((q: any, i: number) => {
              const ans = str(q.answer);
              const isO = ans === 'O';
              return (
                <div key={i} style={{
                  padding: '12px 16px',
                  background: '#242424',
                  borderRadius: 9,
                  border: `1px solid ${isO ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}>
                  {/* 정답 배지 */}
                  <span style={{
                    width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                    background: isO ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    color: isO ? '#22c55e' : '#ef4444',
                    border: `2px solid ${isO ? '#22c55e' : '#ef4444'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17, fontWeight: 900,
                  }}>
                    {isO ? 'O' : 'X'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{q.number ?? i + 1}번</span>
                      <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>{str(q.statement ?? q.question)}</p>
                    </div>
                    {q.explanation && (
                      <p style={{
                        fontSize: 12, color: isO ? '#4ade80' : '#f87171',
                        lineHeight: 1.5, paddingTop: 5,
                        borderTop: '1px solid #333', marginTop: 3,
                      }}>💡 {str(q.explanation)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── SUMMARY ── */
  if (type === 'summary') {
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#22c55e' }} />
        <div style={{ padding: '40px 36px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
            <div style={{ width: 4, height: 28, background: '#22c55e', borderRadius: 2 }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{str(data.title) || '오늘 배운 내용 정리'}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
            {safeItems(data.items).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: '#242424', borderRadius: 8, border: '1px solid #2a3a2a' }}>
                <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: '#e5e5e5', lineHeight: 1.65 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── MICRO-FEEDBACK ── */
  if (type === 'micro-feedback') {
    return (
      <div style={{ ...baseStyle, background: 'linear-gradient(160deg, #1a1a1a 0%, #0a1a2a 100%)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#3b82f6' }} />
        <div style={{ padding: '40px 36px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
            <div style={{ width: 4, height: 28, background: '#3b82f6', borderRadius: 2 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{str(data.title) || '오늘 수업 되돌아보기'}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            {safeItems(data.items).map((item, i) => (
              <div key={i} style={{ padding: '16px 18px', background: 'rgba(59,130,246,0.1)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.25)' }}>
                <span style={{ fontSize: 14, color: '#93c5fd', lineHeight: 1.7 }}>Q{i + 1}. {item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── CUSTOM / FALLBACK ── */
  return (
    <div style={{ ...baseStyle, background: '#1a1a1a' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#F97316' }} />
      <div style={{ padding: '40px 36px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 4, height: 26, background: '#F97316', borderRadius: 2 }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{str(data.title)}</h2>
        </div>
        {data.content && <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.8 }}>{str(data.content)}</p>}
        {data.items && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {safeItems(data.items).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#242424', borderRadius: 7, border: '1px solid #333' }}>
                <span style={{ color: '#F97316' }}>•</span>
                <span style={{ fontSize: 13, color: '#e5e5e5', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
