'use client';

import { useState } from 'react';
import SlideRenderer, { COVER_W, COVER_H, SLIDE_W, SLIDE_H, PASSAGE_W, PASSAGE_H, NAESHIN_W, NAESHIN_H } from '@/components/SlideRenderer';
import SlideApproveToggle from './SlideApproveToggle';
import SlideEditModal from '@/components/SlideEditModal';
import type { SlideItem } from '@/lib/types';

const THUMB_W = 220;

function thumbScale(slide: SlideItem, contiType: string): { scale: number; w: number; h: number } {
  const isPassage = slide.type === 'passage';
  const isCover = slide.type === 'cover';
  const isWide = ['feedback', 'assignment-feedback', 'common-qa', 'objectives', 'summary', 'micro-feedback'].includes(slide.type);
  const isNaeshinPassage = isPassage && contiType === '내신대비용';
  const isRegularPassage = isPassage && !isNaeshinPassage;

  const W = (isCover || isWide) ? COVER_W : isNaeshinPassage ? NAESHIN_W : isRegularPassage ? PASSAGE_W : SLIDE_W;
  const H = (isCover || isWide) ? COVER_H : isNaeshinPassage ? NAESHIN_H : isRegularPassage ? PASSAGE_H : SLIDE_H;
  const scale = THUMB_W / W;
  return { scale, w: THUMB_W, h: Math.round(H * scale) };
}

export default function SlidesGrid({ slides: initialSlides, contiType, projectId }: { slides: SlideItem[]; contiType: string; projectId: string }) {
  const [slides, setSlides] = useState<SlideItem[]>(initialSlides);
  const [preview, setPreview] = useState<SlideItem | null>(null);
  const [editing, setEditing] = useState<SlideItem | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    if (!confirm('슬라이드를 다시 생성하시겠습니까? 현재 슬라이드는 삭제됩니다.')) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.slides) {
        setSlides(data.slides.map((s: any) => ({ ...s, data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data })));
      }
    } catch (e) {
      alert('오류가 발생했습니다: ' + e);
    } finally {
      setRegenerating(false);
    }
  };

  const handleUpdated = (updated: SlideItem) => {
    setSlides(prev => prev.map(s => s.id === updated.id ? updated : s));
    setEditing(updated);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-50 hover:opacity-90 transition"
          style={{ background: '#F97316' }}
        >
          {regenerating ? '재생성 중...' : '슬라이드 재생성'}
        </button>
      </div>
      <div className="flex flex-wrap gap-6 justify-start">
        {slides.map((slide, i) => {
          const { scale, w, h } = thumbScale(slide, contiType);
          return (
            <div key={slide.id} className="flex flex-col items-center">
              {/* 썸네일 */}
              <div className="relative group" style={{ width: w, height: h }}>
                <button
                  onClick={() => setPreview(slide)}
                  className="rounded-lg overflow-hidden border-2 border-gray-700 hover:border-blue-400 transition shadow w-full h-full"
                >
                  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w / scale, height: h / scale }}>
                    <SlideRenderer slide={slide} contiType={contiType} />
                  </div>
                </button>
                {/* 편집 버튼 (호버 시) */}
                <button
                  onClick={() => setEditing(slide)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-white text-xs px-2 py-1 rounded-md"
                  style={{ background: '#F97316' }}
                >
                  편집
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">{i + 1}</span>
                <SlideApproveToggle slideId={slide.id} approved={slide.approved} />
                <button
                  onClick={() => setEditing(slide)}
                  className="text-xs text-gray-500 hover:text-orange-400 transition"
                >
                  ✏️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 미리보기 모달 */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <div className="overflow-auto max-h-screen" onClick={e => e.stopPropagation()}>
            <SlideRenderer slide={preview} contiType={contiType} />
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {editing && (
        <SlideEditModal
          slide={editing}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
