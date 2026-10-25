'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Undo2 } from 'lucide-react';

/** Tombol di sudut postingan: peserta sesi bisa menarik postingan, pengunjung lain bisa melaporkan. */
export function PostActions({ postId, isParticipant }: { postId: string; isParticipant: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function withdraw() {
    if (!window.confirm('Tarik postingan ini dari forum? Sesinya kembali privat dan komentarnya ikut disembunyikan.')) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}/withdraw`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? 'Gagal menarik postingan.');
      return;
    }
    router.push('/beranda');
    router.refresh();
  }

  async function report() {
    const reason = window.prompt('Kenapa postingan ini perlu ditinjau admin? (boleh dikosongkan)');
    if (reason === null) return;
    setBusy(true);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'post', targetId: postId, reason: reason.trim() || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? 'Terima kasih, laporanmu sudah diterima admin.' : body.error ?? 'Gagal mengirim laporan.');
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {isParticipant ? (
        <button type="button" onClick={withdraw} disabled={busy} className="btn-ghost text-sm">
          <Undo2 size={14} /> Tarik postingan
        </button>
      ) : (
        <button type="button" onClick={report} disabled={busy} className="btn-ghost text-sm">
          <Flag size={14} /> Laporkan
        </button>
      )}
      {message && <p className="max-w-xs text-right text-xs text-ink-500">{message}</p>}
    </div>
  );
}
