'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, KeyRound, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import type { Subject } from '@/lib/types';

export default function DaftarTentorPage() {
  return (
    <Suspense fallback={null}>
      <DaftarTentorContent />
    </Suspense>
  );
}

function DaftarTentorContent() {
  const searchParams = useSearchParams();
  const step = searchParams.get('step');

  if (step === 'lengkapi') {
    return <LengkapiForm />;
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
          <GraduationCap size={28} />
        </div>
        <h1 className="text-3xl font-semibold text-ink-900">Daftar sebagai Tentor</h1>
        <p className="mt-2 text-ink-600">
          Siapkan kode akses dari admin sekolah dulu ya — dibutuhkan sekali di langkah berikutnya.
        </p>
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/auth/callback?role=tentor` },
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [username, setUsername] = useState('');
  const [kelas, setKelas] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('subjects')
      .select('id, name, group_name, sort_order')
      .order('sort_order')
      .then(({ data }) => setSubjects((data as Subject[]) ?? []));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Subject[]> = { IPA: [], IPS: [], Wajib: [] };
    for (const s of subjects) map[s.group_name]?.push(s);
    return map;
  }, [subjects]);

  function toggleSubject(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (selected.size === 0) {
      setError('Pilih minimal 1 mapel yang kamu kuasai.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/register/tentor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username,
        kelas,
        password,
        accessCode,
        subjectIds: Array.from(selected),
      }),
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
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Lengkapi profil Tentor</h1>
        <p className="mt-1 text-ink-600">Cuma sekali ini aja — minggu depan tinggal masuk pakai username & password.</p>

        <div className="card mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Username</label>
            <input className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cth. rani_bio" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Kelas</label>
            <input className="input-field" value={kelas} onChange={(e) => setKelas(e.target.value)} placeholder="cth. XI IPA 2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Password</label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-700">
              <KeyRound size={15} /> Kode akses
            </label>
            <input className="input-field" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Dari admin sekolah" />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Mapel yang kamu kuasai (boleh lebih dari satu)</p>
            {(['IPA', 'IPS', 'Wajib'] as const).map((group) => (
              <div key={group} className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {grouped[group]?.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSubject(s.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        selected.has(s.id)
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
