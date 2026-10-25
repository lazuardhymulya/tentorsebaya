'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Flag, ShieldCheck } from 'lucide-react';

interface ReportItem {
  id: string;
  targetType: 'post' | 'comment';
  reason: string | null;
  reporter: string;
  createdAt: string;
  postId: string | null;
  postTitle: string | null;
  postStatus: string | null;
  commentText: string | null;
  commentAuthor: string | null;
  commentHidden: boolean;
}

export function ReportsManager() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/reports');
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? 'Gagal memuat laporan.');
    } else {
      setReports(body.reports ?? []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(reportId: string, action: 'sembunyikan' | 'tarik' | 'abaikan') {
    setBusyId(reportId);
    setError(null);
    const res = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportId, action }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) setError(body.error ?? 'Aksi gagal.');
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-brand-600" />
        <h1 className="text-2xl font-semibold text-ink-900">Laporan konten</h1>
      </div>
      <nav className="mt-2 flex gap-4 text-sm">
        <Link href="/admin/kode-akses" className="text-ink-500 hover:text-brand-600">Kode akses</Link>
        <span className="font-medium text-brand-700">Laporan</span>
      </nav>
      <p className="mt-3 text-ink-600">Postingan dan komentar yang dilaporkan pengguna. Tindakan tidak bisa dibatalkan dari sini.</p>

      {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-3">
        {loaded && reports.length === 0 && !error && (
          <div className="card text-center text-ink-400">Tidak ada laporan baru.</div>
        )}
        {reports.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Flag size={14} />
              <span>
                {r.targetType === 'comment' ? 'Komentar' : 'Postingan'} dilaporkan oleh @{r.reporter} ·{' '}
                {new Date(r.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {r.targetType === 'comment' && (
              <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-ink-50 px-4 py-3 text-ink-800">
                <span className="mb-1 block text-xs font-medium text-ink-500">@{r.commentAuthor ?? 'pengguna'}</span>
                {r.commentText ?? '(komentar sudah dihapus)'}
              </p>
            )}
            {r.postId && (
              <p className="mt-2 text-sm">
                Postingan:{' '}
                <Link href={`/forum/${r.postId}`} target="_blank" className="font-medium text-brand-600 hover:underline">
                  {r.postTitle ?? 'Tanpa judul'}
                </Link>
                {r.postStatus && r.postStatus !== 'tayang' && <span className="text-ink-400"> ({r.postStatus})</span>}
              </p>
            )}
            {r.reason && <p className="mt-2 text-sm text-ink-600">Alasan: {r.reason}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              {r.targetType === 'comment' && (
                <button onClick={() => act(r.id, 'sembunyikan')} disabled={busyId === r.id} className="btn-primary text-sm">
                  Sembunyikan komentar
                </button>
              )}
              {r.targetType === 'post' && (
                <button onClick={() => act(r.id, 'tarik')} disabled={busyId === r.id} className="btn-primary text-sm">
                  Tarik postingan
                </button>
              )}
              <button onClick={() => act(r.id, 'abaikan')} disabled={busyId === r.id} className="btn-secondary text-sm">
                Abaikan laporan
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
