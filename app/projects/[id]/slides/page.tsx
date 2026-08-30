import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SlidesGrid from './SlidesGrid';
import StepProgress from '@/components/StepProgress';
import type { SlideItem } from '@/lib/types';

export default async function SlidesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { slides: { orderBy: { order: 'asc' } } },
  });
  if (!project) redirect('/');

  const slides: SlideItem[] = project.slides.map(s => ({
    ...s,
    data: JSON.parse(s.data),
    type: s.type as SlideItem['type'],
    layout: s.layout as SlideItem['layout'],
  }));

  return (
    <div className="min-h-screen" style={{ background: '#1a1a1a' }}>
      <div className="max-w-7xl mx-auto p-6">
        <StepProgress currentStep={2} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <p className="text-gray-400 text-sm">{project.grade} · {project.topic} · {project.contiType} · 슬라이드 {slides.length}장</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/projects/${id}/analyze`}
              className="text-gray-300 px-4 py-2 rounded-lg hover:text-white transition text-sm"
              style={{ border: '1px solid #444', background: '#2a2a2a' }}
            >
              다시 분석
            </Link>
            <Link
              href={`/projects/${id}/export`}
              className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm"
              style={{ background: '#7c3aed' }}
            >
              내보내기
            </Link>
          </div>
        </div>
        <SlidesGrid slides={slides} contiType={project.contiType} projectId={id} />
      </div>
    </div>
  );
}
