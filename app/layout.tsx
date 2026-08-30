import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "J's Conti Creator",
  description: "Korean English teacher tool for lesson slide generation",
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: '#1a1a1a', color: '#e5e5e5' }}>
        <header style={{ background: '#242424', borderBottom: '1px solid #333' }} className="sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span style={{ color: '#F97316' }} className="text-xl font-bold tracking-tight">J's Conti Creator</span>
              <span className="text-xs px-2 py-0.5 rounded-full text-gray-400" style={{ background: '#333', fontSize: '11px' }}>AI 수업 콘티</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                대시보드
              </Link>
              <Link href="/meetings" className="text-sm text-gray-400 hover:text-white transition-colors">
                회의록
              </Link>
              <Link
                href="/projects/new"
                className="text-sm px-4 py-1.5 rounded-md font-medium transition-colors"
                style={{ background: '#F97316', color: '#fff' }}
              >
                + 새 프로젝트
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
