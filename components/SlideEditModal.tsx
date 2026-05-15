'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SlideRenderer from './SlideRenderer';
import type { SlideItem } from '@/lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SlideEditModalProps {
  slide: SlideItem;
  onClose: () => void;
  onUpdated: (updatedSlide: SlideItem) => void;
}

export default function SlideEditModal({ slide, onClose, onUpdated }: SlideEditModalProps) {
  const [currentSlide, setCurrentSlide] = useState<SlideItem>(slide);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `안녕하세요! **${(slide.data as any).title || slide.type}** 슬라이드를 편집할 수 있어요.\n\n어떤 부분을 수정할까요? 자유롭게 말씀해 주세요.\n\n예시:\n• "제목을 '영웅의 정의'로 바꿔줘"\n• "어휘에 'inspire' 단어 추가해줘"\n• "학습목표 3번을 더 구체적으로 수정해줘"`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isCover = currentSlide.type === 'cover';
  const isPassage = currentSlide.type === 'passage';

  const PREVIEW_W = isCover ? 840 : 600;
  const PREVIEW_H = isCover ? 600 : isPassage ? 1120 : 840;
  const MAX_W = 480;
  const scale = Math.min(MAX_W / PREVIEW_W, 320 / PREVIEW_H);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/slides/${slide.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0),
        }),
      });
      const data = await res.json();

      if (data.updatedData) {
        const updated = { ...currentSlide, data: data.updatedData };
        setCurrentSlide(updated);
        onUpdated(updated);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || '수정되었습니다.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, slide.id, currentSlide, onUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    // 오버레이
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1e1e1e',
        borderRadius: 16,
        border: '1px solid #333',
        width: '100%',
        maxWidth: 1100,
        height: '88vh',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>

        {/* ── 왼쪽: 슬라이드 미리보기 ── */}
        <div style={{
          width: 420,
          flexShrink: 0,
          background: '#141414',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #2a2a2a',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: '#555', textTransform: 'capitalize' }}>{currentSlide.type}</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#e5e5e5', marginTop: 2 }}>
                {(currentSlide.data as any).title || '슬라이드 미리보기'}
              </p>
            </div>
            <span style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(249,115,22,0.15)', color: '#F97316', borderRadius: 20, border: '1px solid rgba(249,115,22,0.3)' }}>
              #{slide.order}
            </span>
          </div>
          {/* 미리보기 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' }}>
            <div style={{
              width: PREVIEW_W * scale,
              height: PREVIEW_H * scale,
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              flexShrink: 0,
            }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PREVIEW_W, height: PREVIEW_H }}>
                <SlideRenderer slide={currentSlide} scale={1} />
              </div>
            </div>
          </div>
          {/* 닫기 버튼 */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #2a2a2a' }}>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '10px', background: '#2a2a2a', border: '1px solid #333', borderRadius: 8, color: '#888', fontSize: 13, cursor: 'pointer' }}
            >
              닫기
            </button>
          </div>
        </div>

        {/* ── 오른쪽: 채팅 ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* 헤더 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e5e5e5' }}>AI 슬라이드 편집</span>
            <span style={{ fontSize: 12, color: '#555', marginLeft: 'auto' }}>Enter로 전송 · Shift+Enter 줄바꿈</span>
          </div>

          {/* 메시지 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 10, marginTop: 2,
                    background: 'linear-gradient(135deg,#F97316,#fb923c)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                  }}>AI</div>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: '11px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#F97316' : '#2a2a2a',
                  color: msg.role === 'user' ? '#fff' : '#ddd',
                  fontSize: 14,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  border: msg.role === 'assistant' ? '1px solid #333' : 'none',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#F97316,#fb923c)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                }}>AI</div>
                <div style={{ padding: '11px 16px', background: '#2a2a2a', borderRadius: '16px 16px 16px 4px', border: '1px solid #333', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map((j) => (
                    <div key={j} style={{
                      width: 7, height: 7, borderRadius: '50%', background: '#555',
                      animation: `bounce 1.2s ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 빠른 명령어 버튼 */}
          <div style={{ padding: '8px 20px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #222' }}>
            {['제목 수정', '내용 추가', '내용 삭제', '더 쉽게 설명', '더 자세히'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => setInput(cmd + ' — ')}
                style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 20,
                  background: '#242424', border: '1px solid #333', color: '#888',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = '#F97316'; (e.target as HTMLElement).style.color = '#F97316'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = '#333'; (e.target as HTMLElement).style.color = '#888'; }}
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* 입력창 */}
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#242424', borderRadius: 12, border: '1px solid #333', padding: '8px 8px 8px 14px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="수정 요청을 입력하세요... (예: 3번 학습목표를 더 구체적으로 바꿔줘)"
                disabled={loading}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#e5e5e5', fontSize: 14, lineHeight: 1.5, resize: 'none',
                  minHeight: 22, maxHeight: 120,
                  fontFamily: 'inherit',
                }}
                rows={1}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: 'none', flexShrink: 0,
                  background: input.trim() && !loading ? '#F97316' : '#333',
                  color: input.trim() && !loading ? '#fff' : '#555',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
