import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import StepProgress from '@/components/StepProgress';
import type { SlideItem } from '@/lib/types';
import SlidesGrid from './SlidesGrid';

interface SlidesPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SlidesPage({ params }: SlidesPageProps) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { slides: { orderBy: { order: 'asc' } } },
  });

  if (!project) notFound();

  const slides: SlideItem[] = project.slides.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    order: s.order,
    type: s.type as SlideItem['type'],
    layout: s.layout as SlideItem['layout'],
    data: JSON.parse(s.data),
    approved: s.approved,
  }));

  const approvedCount = slides.filter((s) => s.approved).length;

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

      <StepProgress currentStep={2} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {slides.length}개 슬라이드 · 승인됨 {approvedCount}개
          </p>
        </div>
        <Link
          href={`/projects/${id}/export`}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 flex items-center gap-2"
          style={{ background: '#F97316', color: '#fff' }}
        >
          내보내기로 이동 →
        </Link>
      </div>

      {slides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-gray-400">슬라이드가 없습니다.</p>
          <Link
            href={`/projects/${id}/analyze`}
            className="px-5 py-2.5 rounded-lg font-medium text-sm"
            style={{ background: '#333', color: '#aaa' }}
          >
            분석 단계로 돌아가기
          </Link>
        </div>
      ) : (
        <SlidesGrid slides={slides} contiType={(project as any).contiType || '정규수업용'} />
      )}
    </div>
  );
}
