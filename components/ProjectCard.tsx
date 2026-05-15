'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import type { ProjectItem } from '@/lib/types';

interface ProjectCardProps {
  project: ProjectItem;
}

const statusMap = {
  analyze: { label: '분석 단계', color: '#F97316' },
  slides: { label: '슬라이드 편집', color: '#3b82f6' },
  export: { label: '내보내기', color: '#22c55e' },
};

const statusHrefMap = {
  analyze: 'analyze',
  slides: 'slides',
  export: 'export',
};

export default function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const status = statusMap[project.status as keyof typeof statusMap] || statusMap.analyze;
  const href = `/projects/${project.id}/${statusHrefMap[project.status as keyof typeof statusHrefMap] || 'analyze'}`;

  const date = new Date(project.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      setDeleting(false);
    }
  };

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditName(project.name);
    setEditing(true);
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setEditName(project.name);
  };

  const saveName = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === project.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      router.refresh();
      setEditing(false);
    } catch {
      /* 실패해도 닫기 */
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="relative group">
      <Link href={href} className="block" onClick={(e) => editing && e.preventDefault()}>
        <div
          className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:scale-[1.02] hover:shadow-xl cursor-pointer"
          style={{ background: '#242424', border: '1px solid #333' }}
        >
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}
              >
                {project.subject}
              </span>
              {(project as any).contiType && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: (project as any).contiType === '내신대비용' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
                    color: (project as any).contiType === '내신대비용' ? '#a855f7' : '#3b82f6',
                  }}
                >
                  {(project as any).contiType}
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500 flex items-center gap-1 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {project.slideCount}장
            </span>
          </div>

          {/* Project name — 인라인 편집 */}
          <div>
            {editing ? (
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-2 py-1 rounded-md text-sm font-bold text-white outline-none"
                  style={{ background: '#1a1a1a', border: '1px solid #F97316', minWidth: 0 }}
                />
                {/* 저장 버튼 */}
                <button
                  onClick={saveName}
                  disabled={saving}
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ background: '#F97316' }}
                  title="저장"
                >
                  {saving ? (
                    <svg className="w-3 h-3 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                {/* 취소 버튼 */}
                <button
                  onClick={cancelEdit}
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ background: '#333' }}
                  title="취소"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/name">
                <h3 className="font-bold text-white text-base leading-tight group-hover:text-orange-400 transition-colors">
                  {project.name}
                </h3>
                {/* 연필 아이콘 — 호버 시 표시 */}
                <button
                  onClick={startEdit}
                  className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                  title="이름 편집"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-1">
              {project.grade} · {project.topic}
            </p>
          </div>

          {/* Status & date */}
          <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: '#333' }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: status.color }} />
              <span className="text-xs" style={{ color: status.color }}>{status.label}</span>
            </div>
            <span className="text-xs text-gray-600">{date}</span>
          </div>
        </div>
      </Link>

      {/* 삭제 버튼 */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-150 rounded-md px-2 py-1 text-xs font-medium flex items-center gap-1"
        style={{
          background: confirm ? 'rgba(239,68,68,0.9)' : 'rgba(60,60,60,0.95)',
          color: confirm ? '#fff' : '#aaa',
          border: confirm ? '1px solid #ef4444' : '1px solid #444',
        }}
        title="삭제"
      >
        {deleting ? (
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
        {confirm ? '확인' : '삭제'}
      </button>
    </div>
  );
}
