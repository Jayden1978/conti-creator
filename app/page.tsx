import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ProjectCard from '@/components/ProjectCard';
import type { ProjectItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getProjects(): Promise<ProjectItem[]> {
  const projects = await prisma.project.findMany({
    include: { _count: { select: { slides: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    subject: p.subject,
    grade: p.grade,
    topic: p.topic,
    status: p.status as ProjectItem['status'],
    slideCount: p._count.slides,
    createdAt: p.createdAt.toISOString(),
  }));
}

export default async function HomePage() {
  const projects = await getProjects();

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">내 프로젝트</h1>
          <p className="text-sm text-gray-500 mt-1">수업 콘티 프로젝트를 관리하세요</p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90"
          style={{ background: '#F97316', color: '#fff' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          새 프로젝트
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: '#242424' }}
          >
            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">프로젝트가 없습니다</p>
            <p className="text-sm text-gray-500 mt-2">새 프로젝트를 만들어 AI로 수업 콘티를 생성해보세요</p>
          </div>
          <Link
            href="/projects/new"
            className="px-6 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: '#F97316', color: '#fff' }}
          >
            첫 프로젝트 만들기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
