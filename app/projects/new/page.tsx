'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    grade: '고2',
    topic: '',
    contiType: '정규수업용',
    className: '',
    classDay: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const project = await res.json();
      router.push(`/projects/${project.id}/analyze`);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500";
  const inputStyle = { background: '#2a2a2a', border: '1px solid #444' };
  const labelCls = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1a1a1a' }}>
      <div className="rounded-2xl shadow-xl p-8 w-full max-w-lg" style={{ background: '#242424', border: '1px solid #333' }}>
        <h1 className="text-2xl font-bold text-white mb-6">새 콘티 만들기</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelCls}>콘티 이름</label>
            <input
              type="text"
              required
              placeholder="예: 6월 모의고사 대비"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelCls}>학년</label>
            <select
              value={form.grade}
              onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            >
              {['고1', '고2', '고3', '중1', '중2', '중3'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>주제 / 단원</label>
            <input
              type="text"
              required
              placeholder="예: 2025년 6월 모의고사"
              value={form.topic}
              onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelCls}>콘티 유형</label>
            <div className="flex gap-6">
              {['정규수업용', '내신대비용'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="contiType"
                    value={t}
                    checked={form.contiType === t}
                    onChange={e => setForm(f => ({ ...f, contiType: e.target.value }))}
                  />
                  <span className="text-sm text-gray-200">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>반 이름 (선택)</label>
              <input
                type="text"
                placeholder="예: A반"
                value={form.className}
                onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>수업 요일 (선택)</label>
              <input
                type="text"
                placeholder="예: 월수금"
                value={form.classDay}
                onChange={e => setForm(f => ({ ...f, classDay: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex-1 rounded-lg py-3 font-medium transition text-gray-300 hover:text-white"
              style={{ background: '#333', border: '1px solid #444' }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-white rounded-lg py-3 font-medium transition disabled:opacity-60 hover:opacity-90"
              style={{ background: '#F97316' }}
            >
              {loading ? '생성 중...' : '다음'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
