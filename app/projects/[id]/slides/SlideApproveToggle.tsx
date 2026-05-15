'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface SlideApproveToggleProps {
  slideId: string;
  approved: boolean;
}

export default function SlideApproveToggle({ slideId, approved: initialApproved }: SlideApproveToggleProps) {
  const [approved, setApproved] = useState(initialApproved);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = async () => {
    const newValue = !approved;
    setApproved(newValue);
    try {
      await fetch(`/api/slides/${slideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: newValue }),
      });
      startTransition(() => router.refresh());
    } catch {
      setApproved(!newValue);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
      style={{
        background: approved ? 'rgba(34,197,94,0.15)' : '#333',
        color: approved ? '#22c55e' : '#888',
        border: `1px solid ${approved ? 'rgba(34,197,94,0.3)' : '#444'}`,
      }}
    >
      {approved ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          승인됨
        </>
      ) : (
        <>승인</>
      )}
    </button>
  );
}
