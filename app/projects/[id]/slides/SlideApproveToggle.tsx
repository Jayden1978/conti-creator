'use client';

import { useState } from 'react';

export default function SlideApproveToggle({ slideId, approved: initial }: { slideId: string; approved: boolean }) {
  const [approved, setApproved] = useState(initial);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const res = await fetch(`/api/slides/${slideId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: !approved }),
    });
    if (res.ok) setApproved(a => !a);
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-3 py-1 rounded-full font-medium transition ${
        approved ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-500 border border-gray-300'
      }`}
    >
      {approved ? '✓ 승인' : '승인'}
    </button>
  );
}
