import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const statusMap: Record<string, string> = {
    analyze: 'analyze',
    slides: 'slides',
    export: 'export',
  };

  const step = statusMap[project.status] || 'analyze';
  redirect(`/projects/${id}/${step}`);
}
