'use client';

import { useEffect, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useSessionProfile } from '@/lib/useSessionProfile';

interface ReviewItem {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string; role: 'tentor' | 'mentee' } | null;
}

export function ReviewSection() {
  const { profile } = useSessionProfile();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews ?? []))
      .finally(() => setLoaded(true));
  }, []);

  async function submit() {
    if (text.trim().length < 5) return;
    setSubmitting(true);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text.trim() }),
    });
    setSubmitting(false);
    if (res.ok) {
      const { review } = await res.json();
      setReviews((prev) => [{ ...review, profiles: { username: profile?.username, role: profile?.role } }, ...prev]);
      setText('');
    }
  }

  return (
    <section id="ulasan" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-3xl font-semibold text-ink-900">Kata mereka soal Pilots</h2>
      <p className="mt-2 max-w-xl text-ink-600">
        Ulasan asli dari pelajar yang sudah pakai Pilots — bukan testimoni karangan.
      </p>

      {profile && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ceritain pengalaman kamu pakai Pilots…"
            className="input-field"
            maxLength={500}
          />
          <button onClick={submit} disabled={submitting || text.trim().length < 5} className="btn-primary whitespace-nowrap">
            <MessageSquarePlus size={18} /> Kirim ulasan
          </button>
        </div>
      )}

      <div className="mt-8">
        {loaded && reviews.length === 0 && (
          <div className="card text-center text-ink-500">
            Belum ada ulasan. {profile ? 'Jadilah yang pertama nulis di atas.' : 'Masuk dulu buat jadi yang pertama nulis ulasan.'}
          </div>
        )}

        {reviews.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.id} className="card">
                <p className="text-ink-800">&ldquo;{r.content}&rdquo;</p>
                <p className="mt-3 text-sm font-medium text-ink-500">
                  {r.profiles?.username ?? 'Pengguna'}{' '}
                  <span className="font-normal text-ink-400">
                    · {r.profiles?.role === 'tentor' ? 'Tentor' : 'Mentee'}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
