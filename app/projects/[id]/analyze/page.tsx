'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StepProgress from '@/components/StepProgress';

export default function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [content, setContent] = useState('');
  const [fileData, setFileData] = useState<{ type: 'image' | 'pdf'; base64: string; mediaType: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [project, setProject] = useState<{ name: string; grade: string; topic: string; contiType: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(p => {
        setProject(p);
        if (p.analysis) setAnalysisResult(p.analysis);
        if (p.status === 'slides') router.push(`/projects/${id}/slides`);
      });
  }, [id, router]);

  const readFile = useCallback((file: File) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (ext === 'txt' || ext === 'text') {
      reader.onload = e => {
        setContent(e.target?.result as string ?? '');
        setFileData(null);
      };
      reader.readAsText(file, 'utf-8');
    } else if (ext === 'pdf') {
      reader.onload = e => {
        const base64 = (e.target?.result as string).split(',')[1];
        setFileData({ type: 'pdf', base64, mediaType: 'application/pdf' });
        setContent('__pdf__');
      };
      reader.readAsDataURL(file);
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) {
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        const mediaType = file.type;
        setFileData({ type: 'image', base64, mediaType });
        setContent('__image__');
      };
      reader.readAsDataURL(file);
    } else {
      alert('지원 형식: .txt, .pdf, .jpg, .png');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleAnalyze = async () => {
    if (!content && !fileData) return alert('지문을 입력하거나 파일을 업로드해주세요.');
    setAnalyzing(true);
    try {
      const body = fileData
        ? { projectId: id, files: [fileData] }
        : { projectId: id, content };
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysisResult(data.analysis);
    } catch (err) {
      alert('분석 중 오류가 발생했습니다: ' + err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/projects/${id}/slides`);
    } catch (err) {
      alert('슬라이드 생성 중 오류가 발생했습니다: ' + err);
      setGenerating(false);
    }
  };

  const cardStyle = { background: '#242424', border: '1px solid #333' };
  const inputStyle = { background: '#2a2a2a', border: '1px solid #444' };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a1a' }}>
      <div className="max-w-4xl mx-auto p-6">
        <StepProgress currentStep={1} />
        {project && (
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <p className="text-gray-400 text-sm">{project.grade} · {project.topic} · {project.contiType}</p>
          </div>
        )}

        <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
          <h2 className="text-lg font-semibold text-white mb-4">지문 업로드</h2>

          {/* 드래그 앤 드롭 영역 */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all mb-4"
            style={{
              border: `2px dashed ${dragging ? '#F97316' : '#555'}`,
              background: dragging ? 'rgba(249,115,22,0.08)' : '#1e1e1e',
              minHeight: 160,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.text,.pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileChange}
            />
            <svg className="w-10 h-10" style={{ color: dragging ? '#F97316' : '#666' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {fileName ? (
              <div className="text-center">
                <p className="text-orange-400 font-medium">{fileName}</p>
                <p className="text-gray-500 text-sm mt-1">다른 파일로 교체하려면 클릭하세요</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-300 font-medium">파일을 여기에 드래그하거나 클릭해서 선택</p>
                <p className="text-gray-500 text-sm mt-1">지원 형식: .txt, .pdf, .jpg, .png</p>
              </div>
            )}
          </div>

          {/* 직접 입력 */}
          <details className="mb-4">
            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition select-none">
              또는 직접 붙여넣기
            </summary>
            <textarea
              value={content}
              onChange={e => { setContent(e.target.value); setFileName(''); }}
              placeholder="분석할 영어 지문을 여기에 붙여넣으세요..."
              className="w-full h-48 rounded-lg p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-200 placeholder-gray-600 mt-3"
              style={inputStyle}
            />
          </details>

          {(content && !['__pdf__', '__image__'].includes(content)) && (
            <p className="text-xs text-gray-500 mb-3">
              {content.length.toLocaleString()}자 로드됨
            </p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={analyzing || (!content && !fileData)}
            className="text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-40 hover:opacity-90"
            style={{ background: '#F97316' }}
          >
            {analyzing ? '분석 중...' : '지문 분석 시작'}
          </button>
        </div>

        {analysisResult && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <h2 className="text-lg font-semibold text-white mb-3">분석 결과</h2>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap rounded-lg p-4 max-h-80 overflow-y-auto" style={{ background: '#1a1a1a' }}>
              {analysisResult}
            </pre>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-4 text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-40 hover:opacity-90"
              style={{ background: '#22c55e' }}
            >
              {generating ? '슬라이드 생성 중...' : '슬라이드 생성'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
