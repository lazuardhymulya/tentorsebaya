import Link from 'next/link';
import { GraduationCap, HandHelping } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default async function DaftarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const belumTerdaftar = params['belum-terdaftar'] === '1';

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {belumTerdaftar && (
          <div className="mb-6 rounded-2xl border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-700">
            Akun Google itu belum terdaftar di TentorSebaya. Pilih mau daftar sebagai apa dulu ya.
          </div>
        )}

        <h1 className="text-3xl font-semibold text-ink-900">Mau daftar sebagai apa?</h1>
        <p className="mt-2 text-ink-600">Kamu bisa gabung sebagai yang bertanya, atau yang membantu jawab.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/daftar/mentee" className="card group transition hover:border-brand-300 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <GraduationCap size={24} />
            </div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Mentee</h2>
            <p className="mt-1 text-ink-600">Punya soal yang belum kelar? Daftar buat mulai tanya-tanya.</p>
          </Link>

          <Link href="/daftar/tentor" className="card group transition hover:border-brand-300 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
              <HandHelping size={24} />
            </div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Tentor</h2>
            <p className="mt-1 text-ink-600">Jago di mapel tertentu? Daftar jadi tentor, butuh kode akses.</p>
          </Link>
        </div>

        <p className="mt-8 text-sm text-ink-500">
          Sudah punya akun? <Link href="/masuk" className="font-medium text-brand-600 hover:underline">Masuk di sini</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
