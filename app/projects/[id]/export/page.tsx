'use client';

import { use, useEffect, useRef, useState } from 'react';
import SlideRenderer from '@/components/SlideRenderer';
import StepProgress from '@/components/StepProgress';
import Link from 'next/link';
import type { SlideItem } from '@/lib/types';

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [project, setProject] = useState<{ name: string; grade: string; topic: string; contiType: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pngLoading, setPngLoading] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(p => {
        setProject(p);
        setSlides(p.slides || []);
        setLoading(false);
      });
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPng = async () => {
    setPngLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const JSZip = (await import('jszip')).default;
      const projectName = project?.name ?? '콘티';
      const zip = new JSZip();

      for (let i = 0; i < slideRefs.current.length; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
        zip.file(`${projectName}_슬라이드${String(i + 1).padStart(2, '0')}.png`, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_슬라이드.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PNG 저장 중 오류가 발생했습니다: ' + e);
    } finally {
      setPngLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a1a' }}>
      <p className="text-gray-400">불러오는 중...</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#1a1a1a' }}>
      <div className="max-w-5xl mx-auto p-6 print:p-0">
        <div className="print:hidden mb-6">
          <StepProgress currentStep={3} />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{project?.name}</h1>
              <p className="text-gray-400 text-sm">{project?.grade} · {project?.topic} · {project?.contiType}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/projects/${id}/slides`}
                className="text-gray-300 px-4 py-2 rounded-lg transition text-sm hover:text-white"
                style={{ border: '1px solid #444', background: '#2a2a2a' }}
              >
                슬라이드 보기
              </Link>
              <button
                onClick={handleDownloadPng}
                disabled={pngLoading}
                className="text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50 hover:opacity-90"
                style={{ background: '#7c3aed' }}
              >
                {pngLoading ? 'PNG 저장 중...' : 'PNG 저장'}
              </button>
              <button
                onClick={handlePrint}
                className="text-white px-4 py-2 rounded-lg transition text-sm hover:opacity-90"
                style={{ background: '#F97316' }}
              >
                PDF 저장
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {slides.map((slide, i) => (
            <div key={slide.id} className="flex justify-center">
              <div ref={el => { slideRefs.current[i] = el; }}>
                <SlideRenderer slide={slide} contiType={project?.contiType} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
