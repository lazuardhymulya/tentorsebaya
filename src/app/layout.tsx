import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';
import { GiftHost } from '@/components/GiftHost';

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    'Ajukan pertanyaan pelajaran, dicocokkan otomatis dengan tentor sesama pelajar SMA yang sedang online, lalu lanjut chat sampai soalnya kelar.',
};

// viewportFit 'cover' + interactiveWidget: supaya kolom ketik tidak tertutup toolbar/keyboard HP
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink-50 font-sans text-ink-900 antialiased">
        {children}
        <GiftHost />
      </body>
    </html>
  );
}
