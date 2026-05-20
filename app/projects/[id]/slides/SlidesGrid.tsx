'use client';

import { useState } from 'react';
import SlideRenderer from '@/components/SlideRenderer';
import SlideApproveToggle from './SlideApproveToggle';
import SlideEditModal from '@/components/SlideEditModal';
import type { SlideItem } from '@/lib/types';

interface SlidesGridProps {
  slides: SlideItem[];
  contiType?: string;
}

export default function SlidesGrid({ slides: initialSlides, contiType }: SlidesGridProps) {
  const [slides, setSlides] = useState<SlideItem[]>(initialSlides);
  const [editingSlide, setEditingSlide] = useState<SlideItem | null>(null);

  const handleUpdated = (updated: SlideItem) => {
    setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="rounded-xl overflow-hidden flex flex-col group cursor-pointer"
            style={{
              background: '#242424',
              border: `1px solid ${slide.approved ? '#22c55e' : '#333'}`,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!slide.approved) (e.currentTarget as HTMLElement).style.borderColor = '#F97316';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = slide.approved ? '#22c55e' : '#333';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
            onClick={() => setEditingSlide(slide)}
          >
            {/* 슬라이드 썸네일 */}
            <div
              className="relative overflow-hidden"
              style={{ height: (['cover','feedback','assignment-feedback','common-qa'].includes(slide.type)) ? 182 : slide.type === 'passage' ? 373 : 280 }}
            >
              <div style={{
                width: (['cover','feedback','assignment-feedback','common-qa'].includes(slide.type)) ? 1080 : 600,
                height: (['cover','feedback','assignment-feedback','common-qa'].includes(slide.type)) ? 600 : slide.type === 'passage' ? 1120 : 840,
                transform: (['cover','feedback','assignment-feedback','common-qa'].includes(slide.type)) ? 'scale(0.303)' : 'scale(0.333)',
                transformOrigin: 'top left',
                pointerEvents: 'none',
              }}>
                <SlideRenderer slide={slide} scale={1} contiType={contiType} />
              </div>

              {/* 슬라이드 번호 */}
              <div
                className="absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
              >
                {slide.order}
              </div>

              {/* 호버 편집 오버레이 */}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 24,
                  background: '#F97316', color: '#fff',
                  fontSize: 13, fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(249,115,22,0.4)',
                }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  AI로 편집
                </div>
              </div>
            </div>

            {/* 카드 하단 */}
            <div
              className="px-4 py-3 flex items-center justify-between border-t"
              style={{ borderColor: '#333' }}
              onClick={(e) => e.stopPropagation()} // 승인 버튼 클릭 시 모달 안 열리게
            >
              <div>
                <p className="text-sm font-medium text-white truncate max-w-[140px]">
                  {(slide.data as any).title || slide.type}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{slide.type}</p>
              </div>
              <SlideApproveToggle slideId={slide.id} approved={slide.approved} />
            </div>
          </div>
        ))}
      </div>

      {/* 편집 모달 */}
      {editingSlide && (
        <SlideEditModal
          slide={editingSlide}
          onClose={() => setEditingSlide(null)}
          onUpdated={handleUpdated}
        />
      )}
    </>
  );
}
