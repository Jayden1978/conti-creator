'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadZoneProps {
  onFilesChange: (files: File[]) => void;
  files: File[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function UploadZone({ onFilesChange, files }: UploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesChange([...files, ...acceptedFiles]);
  }, [files, onFilesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className="rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all"
        style={{
          borderColor: isDragActive ? '#F97316' : '#444',
          background: isDragActive ? 'rgba(249,115,22,0.05)' : '#242424',
        }}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: isDragActive ? 'rgba(249,115,22,0.2)' : '#333' }}
          >
            <svg className="w-7 h-7" style={{ color: isDragActive ? '#F97316' : '#888' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          {isDragActive ? (
            <p className="text-base font-medium" style={{ color: '#F97316' }}>파일을 여기에 놓으세요</p>
          ) : (
            <>
              <p className="text-base font-medium text-white">클릭하거나 파일을 드래그하세요</p>
              <p className="text-sm text-gray-500">PDF · JPG · PNG · WEBP 지원 · 여러 파일 가능</p>
              <p className="text-xs mt-1" style={{ color: '#888' }}>텍스트 PDF 바로 분석 가능 · 스캔 PDF는 이미지로 변환 권장</p>
            </>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-400 font-medium">업로드된 파일 ({files.length}개)</p>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ background: '#242424', border: '1px solid #333' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                  style={{
                    background: file.type === 'application/pdf' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                    color: file.type === 'application/pdf' ? '#ef4444' : '#3b82f6',
                  }}
                >
                  {file.type === 'application/pdf' ? 'PDF' : 'IMG'}
                </div>
                <div>
                  <p className="text-sm text-white font-medium truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-600 hover:text-red-400 transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
