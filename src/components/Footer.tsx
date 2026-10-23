import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { FooterPhoto } from './FooterPhoto';

export function Footer() {
  return (
    <>
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-ink-900">{APP_NAME}</p>
            <p className="mt-1 max-w-xs text-sm text-ink-600">
              Tempat pelajar SMA saling bantu jawab soal — tanya sekarang, dijawab
              sesama pelajar yang lagi online.
            </p>
          </div>
          <div className="flex gap-10 text-sm">
            <div>
              <p className="mb-2 font-medium text-ink-900">Mulai</p>
              <ul className="space-y-1.5 text-ink-600">
                <li><Link href="/daftar/mentee" className="hover:text-brand-600">Daftar sebagai Mentee</Link></li>
                <li><Link href="/daftar/tentor" className="hover:text-brand-600">Daftar sebagai Tentor</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium text-ink-900">Lainnya</p>
              <ul className="space-y-1.5 text-ink-600">
                <li><a href="#ulasan" className="hover:text-brand-600">Ulasan</a></li>
                <li><Link href="/admin/login" className="hover:text-brand-600">Panel admin</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-ink-400">
          © {new Date().getFullYear()} {APP_NAME}. Dibuat oleh & untuk pelajar.
        </p>
      </div>
    </footer>
    <FooterPhoto />
    </>
  );
}
