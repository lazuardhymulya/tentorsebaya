'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { KeyRound, Loader2, LogIn } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';

export default function MasukPage() {
  return (
    <Suspense fallback={null}>
      <MasukContent />
    </Suspense>
  );
}

function MasukContent() {
  const searchParams = useSearchParams();
  const step = searchParams.get('step');
  const redirect = searchParams.get('redirect');
  const errorParam = searchParams.get('error');

  if (step === 'konfirmasi') {
    return <KonfirmasiForm redirect={redirect} />;
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <LogIn size={26} />
        </div>
        <h1 className="text-3xl font-semibold text-ink-900">Masuk ke TentorSebaya</h1>
        <p className="mt-2 text-ink-600">Pakai akun Google yang sama waktu kamu daftar dulu.</p>

        {errorParam && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            Gagal masuk, coba lagi ya.
          </p>
        )}

        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
          }}
          className="btn-primary mt-8 w-full"
        >
          Lanjut dengan Google
        </button>
        <p className="mt-4 text-sm text-ink-500">
          Belum punya akun? <a href="/daftar" className="font-medium text-brand-600 hover:underline">Daftar di sini</a>
        </p>
      </main>
      <Footer />
    </>
  );
}

function KonfirmasiForm({ redirect }: { redirect: string | null }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const res = await fetch('/api/login', {
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
    router.push(redirect || '/dashboard');
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Konfirmasi username & password</h1>
        <p className="mt-1 text-ink-600">Google-nya sudah cocok, tinggal satu langkah lagi.</p>

        <div className="card mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Username</label>
            <input className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-700">
              <KeyRound size={15} /> Password
            </label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={submit} disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Masuk'}
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
