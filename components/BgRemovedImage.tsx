'use client';

import { useEffect, useState } from 'react';

interface Props {
  src: string;
  style?: React.CSSProperties;
  alt?: string;
  tolerance?: number; // 배경색 허용 오차 (기본 40)
}

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export default function BgRemovedImage({ src, style, alt = '', tolerance = 40 }: Props) {
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      // 모서리 여러 지점에서 배경색 평균 추출
      const samplePoints = [
        [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
        [Math.floor(w * 0.25), 0], [Math.floor(w * 0.75), 0],
        [0, Math.floor(h * 0.25)], [0, Math.floor(h * 0.75)],
        [w - 1, Math.floor(h * 0.25)], [w - 1, Math.floor(h * 0.75)],
      ];
      let bgR = 0, bgG = 0, bgB = 0;
      for (const [sx, sy] of samplePoints) {
        const i = (sy * w + sx) * 4;
        bgR += d[i]; bgG += d[i + 1]; bgB += d[i + 2];
      }
      bgR = Math.round(bgR / samplePoints.length);
      bgG = Math.round(bgG / samplePoints.length);
      bgB = Math.round(bgB / samplePoints.length);

      // 가장자리부터 flood fill — 배경색과 유사한 픽셀만 투명화
      const visited = new Uint8Array(w * h);
      const queue: number[] = [];

      const enqueue = (pos: number) => {
        if (!visited[pos]) { visited[pos] = 1; queue.push(pos); }
      };

      // 상하좌우 가장자리를 시작점으로
      for (let x = 0; x < w; x++) { enqueue(x); enqueue((h - 1) * w + x); }
      for (let y = 1; y < h - 1; y++) { enqueue(y * w); enqueue(y * w + (w - 1)); }

      while (queue.length > 0) {
        const pos = queue.pop()!;
        const idx = pos * 4;
        const r = d[idx], g = d[idx + 1], b = d[idx + 2];

        if (colorDist(r, g, b, bgR, bgG, bgB) > tolerance) continue;

        d[idx + 3] = 0; // 투명

        const x = pos % w;
        const y = Math.floor(pos / w);
        if (x > 0)     enqueue(pos - 1);
        if (x < w - 1) enqueue(pos + 1);
        if (y > 0)     enqueue(pos - w);
        if (y < h - 1) enqueue(pos + w);
      }

      ctx.putImageData(imageData, 0, 0);
      setResult(canvas.toDataURL('image/png'));
    };
    img.src = src;
  }, [src, tolerance]);

  // 처리 전: 원본 표시 (깜빡임 방지)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={result ?? src}
      alt={alt}
      style={style}
    />
  );
}
