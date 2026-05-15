'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import StepProgress from '@/components/StepProgress';
import SlideRenderer from '@/components/SlideRenderer';
import type { SlideItem } from '@/lib/types';

interface ExportPageProps {
  params: Promise<{ id: string }>;
}

export default function ExportPage({ params }: ExportPageProps) {
  const { id } = use(params);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProjectName(data.project?.name || '프로젝트');
        const allSlides: SlideItem[] = (data.slides || []).map((s: any) => ({
          ...s,
          data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data,
        }));
        const approved = allSlides.filter((s) => s.approved);
        setSlides(approved.length > 0 ? approved : allSlides);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // 슬라이드 타입+제목 기반 파일명 생성
  const getSlideFileName = (slide: SlideItem): string => {
    const order = String(slide.order).padStart(2, '0');
    const typeLabel: Record<string, string> = {
      'cover': '표지',
      'feedback': 'Micro_Feedback',
      'assignment-feedback': '과제_피드백',
      'common-qa': '공통질문_풀이',
      'objectives': '학습_목표',
      'passage': '지문',
      'vocabulary': '주요_어휘',
      'ox-quiz': 'OX_퀴즈',
      'ox-answer': 'OX_정답',
      'grammar-quiz': '어법_퀴즈',
      'grammar-answer': '어법_정답',
      'summary': '정리',
      'micro-feedback': '되돌아보기',
      'custom': '기타',
    };
    const label = typeLabel[slide.type] || slide.type;
    // 제목에서 파일명으로 쓸 수 없는 문자 제거
    const rawTitle = String((slide.data as any).title || '');
    const cleanTitle = rawTitle
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 30);
    const titlePart = cleanTitle ? `_${cleanTitle}` : '';
    return `${order}_${label}${titlePart}.png`;
  };

  const downloadSlidePng = async (index: number) => {
    const el = slideRefs.current[index];
    if (!el) return;
    setDownloadingIdx(index);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = getSlideFileName(slides[index]);
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloadingIdx(null);
    }
  };

  const downloadAllZip = async () => {
    setDownloadingAll(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < slides.length; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, {
          backgroundColor: '#1a1a1a',
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        zip.file(getSlideFileName(slides[i]), blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `${projectName}-slides.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-2">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          대시보드
        </Link>
      </div>

      <StepProgress currentStep={3} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{projectName} — 내보내기</h1>
          <p className="text-sm text-gray-500 mt-1">{slides.length}개 슬라이드</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/projects/${id}/slides`}
            className="px-4 py-2.5 rounded-lg font-medium text-sm transition-all hover:opacity-80"
            style={{ background: '#333', color: '#aaa' }}
          >
            ← 슬라이드 편집
          </Link>
          <button
            onClick={downloadAllZip}
            disabled={downloadingAll || slides.length === 0}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ background: '#F97316', color: '#fff' }}
          >
            {downloadingAll ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                ZIP 생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ZIP 다운로드
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <svg className="w-8 h-8 animate-spin" style={{ color: '#F97316' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : slides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-gray-400">내보낼 슬라이드가 없습니다.</p>
          <Link href={`/projects/${id}/slides`} className="px-5 py-2.5 rounded-lg font-medium text-sm" style={{ background: '#333', color: '#aaa' }}>
            슬라이드 편집으로 돌아가기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="rounded-xl overflow-hidden"
              style={{ background: '#242424', border: '1px solid #333' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: '#333' }}>
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: '#F97316', color: '#fff' }}
                  >
                    {slide.order}
                  </span>
                  <span className="text-sm font-medium text-white">{(slide.data as any).title || slide.type}</span>
                  <span className="text-xs text-gray-500 capitalize">{slide.type}</span>
                </div>
                <button
                  onClick={() => downloadSlidePng(index)}
                  disabled={downloadingIdx === index}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ background: '#333', color: '#aaa', border: '1px solid #444' }}
                >
                  {downloadingIdx === index ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      저장 중
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      PNG
                    </>
                  )}
                </button>
              </div>

              {/* Full-size slide render */}
              <div className="flex justify-center p-6" style={{ background: '#1a1a1a' }}>
                <div
                  ref={(el) => { slideRefs.current[index] = el; }}
                  style={{
                    width: (['cover','feedback','assignment-feedback','common-qa'].includes(slide.type)) ? 1080 : 600,
                    height: (['cover','feedback','assignment-feedback','common-qa'].includes(slide.type)) ? 600 : slide.type === 'passage' ? 1120 : 840,
                    flexShrink: 0
                  }}
                >
                  <SlideRenderer slide={slide} scale={1} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
