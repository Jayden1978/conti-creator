'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StepProgress from '@/components/StepProgress';
import UploadZone from '@/components/UploadZone';

interface AnalyzePageProps {
  params: Promise<{ id: string }>;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AnalyzePage({ params }: AnalyzePageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('분석할 파일을 업로드해주세요.');
      return;
    }
    setAnalyzing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('projectId', id);
      files.forEach((file) => formData.append('files', file));

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');
      setAnalysis(data.analysis);
    } catch (e: any) {
      setError(e?.message || '분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateSlides = async () => {
    if (!analysis) return;
    setGenerating(true);
    setError('');
    try {
      const fileData = await Promise.all(
        files.map(async (file) => ({
          type: file.type === 'application/pdf' ? 'pdf' as const : 'image' as const,
          base64: await fileToBase64(file),
          mediaType: file.type,
        }))
      );

      const res = await fetch('/api/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, analysis, files: fileData }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '슬라이드 생성 실패');
      router.push(`/projects/${id}/slides`);
    } catch (e: any) {
      setError(e?.message || '슬라이드 생성 중 오류가 발생했습니다.');
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-2">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          대시보드
        </Link>
      </div>

      <StepProgress currentStep={1} />

      <div className="flex flex-col gap-6">
        {/* Upload zone */}
        <div className="rounded-xl p-6" style={{ background: '#242424', border: '1px solid #333' }}>
          <h2 className="text-base font-semibold text-white mb-4">수업 자료 업로드</h2>
          <UploadZone onFilesChange={setFiles} files={files} />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Analyze button */}
        {!analysis && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing || files.length === 0}
            className="w-full py-3.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#F97316', color: '#fff' }}
          >
            {analyzing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Claude AI가 분석 중... (최대 1-2분 소요)
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI로 분석 시작
              </>
            )}
          </button>
        )}

        {/* Analysis result */}
        {analysis && (
          <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: '#242424', border: '1px solid #333' }}>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: '#22c55e' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-base font-semibold text-white">분석 결과</h2>
            </div>
            <div
              className="rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto"
              style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #2a2a2a' }}
            >
              {analysis}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAnalysis('')}
                className="flex-1 py-3 rounded-lg font-medium text-sm transition-all hover:opacity-80"
                style={{ background: '#333', color: '#aaa' }}
              >
                다시 분석
              </button>
              <button
                onClick={handleGenerateSlides}
                disabled={generating}
                className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: '#F97316', color: '#fff' }}
              >
                {generating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    슬라이드 생성 중...
                  </>
                ) : (
                  '슬라이드 생성 →'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
