'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const GRADES = ['중3', '고1', '고2', '고3'];
const CONTI_TYPES = [
  {
    value: '정규수업용',
    label: '정규수업용 콘티',
    desc: '일반 수업 진행을 위한 콘티',
    icon: '📖',
    color: '#F97316',
  },
  {
    value: '내신대비용',
    label: '내신대비용 콘티',
    desc: '시험 대비 집중 학습 콘티',
    icon: '📝',
    color: '#a855f7',
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    subject: '영어',
    grade: '고2',
    topic: '',
    contiType: '정규수업용',
    className: '',
    classDay: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.topic.trim()) {
      setError('프로젝트 이름과 주제를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('프로젝트 생성 실패');
      const data = await res.json();
      router.push(`/projects/${data.id}/analyze`);
    } catch {
      setError('프로젝트 생성 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          대시보드로 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-white">새 프로젝트</h1>
        <p className="text-sm text-gray-500 mt-1">수업 콘티 프로젝트 정보를 입력하세요</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div
          className="rounded-xl p-8 flex flex-col gap-6"
          style={{ background: '#242424', border: '1px solid #333' }}
        >
          {/* 콘티 유형 선택 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-300">콘티 유형</label>
            <div className="grid grid-cols-2 gap-3">
              {CONTI_TYPES.map((ct) => {
                const selected = form.contiType === ct.value;
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setForm({ ...form, contiType: ct.value })}
                    style={{
                      padding: '16px',
                      borderRadius: 12,
                      border: `2px solid ${selected ? ct.color : '#333'}`,
                      background: selected ? `rgba(${ct.color === '#F97316' ? '249,115,22' : '168,85,247'},0.1)` : '#1a1a1a',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 22 }}>{ct.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: selected ? ct.color : '#e5e5e5' }}>
                        {ct.label}
                      </span>
                      {selected && (
                        <span style={{
                          marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%',
                          background: ct.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#666' }}>{ct.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 프로젝트 이름 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-300">
              프로젝트 이름 <span style={{ color: '#F97316' }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 고2 2학기 1단원 수업 콘티"
              className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none transition-all"
              style={{ background: '#1a1a1a', border: '1px solid #444', color: '#e5e5e5' }}
              onFocus={(e) => (e.target.style.borderColor = '#F97316')}
              onBlur={(e) => (e.target.style.borderColor = '#444')}
            />
          </div>

          {/* 학년 선택 (버튼형) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-300">학년</label>
            <div className="flex gap-2">
              {GRADES.map((g) => {
                const selected = form.grade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm({ ...form, grade: g })}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 10,
                      border: `1.5px solid ${selected ? '#F97316' : '#444'}`,
                      background: selected ? 'rgba(249,115,22,0.12)' : '#1a1a1a',
                      color: selected ? '#F97316' : '#888',
                      fontSize: 14,
                      fontWeight: selected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 주제/테마 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-300">
              주제/테마 <span style={{ color: '#F97316' }}>*</span>
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="예: Heroes and Role Models"
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
              style={{ background: '#1a1a1a', border: '1px solid #444', color: '#e5e5e5' }}
              onFocus={(e) => (e.target.style.borderColor = '#F97316')}
              onBlur={(e) => (e.target.style.borderColor = '#444')}
            />
          </div>

          {/* 반명 + 수업요일 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-300">
                반명
                <span style={{ fontSize: 11, color: '#666', fontWeight: 400, marginLeft: 6 }}>선택</span>
              </label>
              <input
                type="text"
                value={form.className}
                onChange={(e) => setForm({ ...form, className: e.target.value })}
                placeholder="예: 2-3반, A반"
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#e5e5e5' }}
                onFocus={(e) => (e.target.style.borderColor = '#F97316')}
                onBlur={(e) => (e.target.style.borderColor = '#444')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-300">
                수업요일
                <span style={{ fontSize: 11, color: '#666', fontWeight: 400, marginLeft: 6 }}>선택</span>
              </label>
              <input
                type="text"
                value={form.classDay}
                onChange={(e) => setForm({ ...form, classDay: e.target.value })}
                placeholder="예: 월·수, 화요일 3교시"
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#e5e5e5' }}
                onFocus={(e) => (e.target.style.borderColor = '#F97316')}
                onBlur={(e) => (e.target.style.borderColor = '#444')}
              />
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}
        </div>

        {/* 생성 버튼 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: '#F97316', color: '#fff' }}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              생성 중...
            </>
          ) : (
            `${form.contiType} 콘티 만들기 →`
          )}
        </button>
      </form>
    </div>
  );
}
