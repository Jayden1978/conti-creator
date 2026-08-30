import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) redirect('/');
  if (project.status === 'slides') redirect(`/projects/${id}/slides`);
  redirect(`/projects/${id}/analyze`);
}
