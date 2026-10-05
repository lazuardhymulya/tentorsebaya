'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';

export default function DaftarMenteePage() {
  return (
    <Suspense fallback={null}>
      <DaftarMenteeContent />
    </Suspense>
  );
}

function DaftarMenteeContent() {
  const searchParams = useSearchParams();
  const step = searchParams.get('step');

  if (step === 'lengkapi') {
    return <LengkapiForm />;
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <GraduationCap size={28} />
        </div>
        <h1 className="text-3xl font-semibold text-ink-900">Daftar sebagai Mentee</h1>
        <p className="mt-2 text-ink-600">Login pakai Google sekolah/pribadi kamu, lalu buat username & password.</p>
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/auth/callback?role=mentee` },
            });
          }}
          className="btn-primary mt-8 w-full"
        >
          Lanjut dengan Google
        </button>
        <p className="mt-4 text-sm text-ink-500">
          Sudah pernah daftar? <a href="/masuk" className="font-medium text-brand-600 hover:underline">Masuk di sini</a>
        </p>
      </main>
      <Footer />
    </>
  );
}

function LengkapiForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const res = await fetch('/api/register/mentee', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? 'Terjadi kesalahan.');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Buat username & password</h1>
        <p className="mt-1 text-ink-600">Dipakai bareng akun Google kamu tiap kali masuk.</p>

        <div className="card mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Username</label>
            <input className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cth. dinda_09" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Password</label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={submit} disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Selesai daftar'}
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
