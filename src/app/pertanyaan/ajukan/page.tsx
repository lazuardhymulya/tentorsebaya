'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Radar } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import type { Subject } from '@/lib/types';

export default function AjukanPertanyaanPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('subjects')
      .select('id, name, group_name, sort_order')
      .order('sort_order')
      .then(({ data }) => setSubjects((data as Subject[]) ?? []));
  }, []);

  async function submit() {
    setError(null);
    if (!subjectId) return setError('Pilih mapel dulu.');
    if (title.trim().length < 5) return setError('Judul pertanyaan minimal 5 karakter.');
    if (content.trim().length < 5) return setError('Tulis pertanyaannya lebih detail ya.');

    setSubmitting(true);
    const formData = new FormData();
    formData.set('subjectId', subjectId);
    formData.set('title', title.trim());
    formData.set('tags', tags);
    formData.set('content', content.trim());
    if (photo) formData.set('photo', photo);

    const res = await fetch('/api/questions', { method: 'POST', body: formData });
    const body = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? 'Terjadi kesalahan.');
      return;
    }

    setSearching(true);
    setTimeout(() => router.push(`/chat/${body.question.id}`), 1400);
  }

  if (searching) {
    return (
      <>
        <Navbar />
        <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
          <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
            <div className="radar-ring animate-pulse-ring [animation-delay:0s]" />
            <div className="radar-ring animate-pulse-ring [animation-delay:0.6s]" />
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-white">
              <Radar size={26} />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-ink-900">Pertanyaan kamu sedang dicarikan tentor…</h1>
          <p className="mt-2 text-ink-600">Kamu akan dialihkan ke ruang chat sebentar lagi.</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Ajukan Pertanyaan</h1>
        <p className="mt-1 text-ink-600">Semakin jelas soalnya, semakin cepat dijawab.</p>

        <div className="card mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Mapel</label>
            <select className="input-field" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Pilih mapel…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Judul pertanyaan</label>
            <input
              className="input-field"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ringkas, misalnya: Cara menghitung waktu mencapai titik tertinggi"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Topik (opsional)</label>
            <input
              className="input-field"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Pisahkan dengan koma, maksimal 3. Contoh: gerak parabola, kinematika"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Pertanyaan</label>
            <textarea
              className="input-field min-h-32"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis soal atau hal yang belum kamu paham…"
            />
          </div>

          <div>
            <label className="btn-secondary w-full cursor-pointer">
              <Camera size={18} />
              {photo ? photo.name : 'Lampirkan foto soal (opsional)'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button onClick={submit} disabled={submitting} className="btn-primary w-full">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Cari tentor sekarang'}
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
