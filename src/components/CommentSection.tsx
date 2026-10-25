'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Flag, Heart, Loader2, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { UserLink } from './UserLink';

export interface CommentData {
  id: string;
  parentId: string | null;
  authorId: string;
  authorUsername: string;
  content: string;
  isCorrection: boolean;
  hidden: boolean;
  createdAt: string;
  editedAt: string | null;
  likeCount: number;
  likedByMe: boolean;
}

interface Props {
  postId: string;
  viewerId: string;
  tentorId: string;
  menteeId: string;
  anonymous: boolean;
  comments: CommentData[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function CommentSection({ postId, viewerId, tentorId, menteeId, anonymous, comments }: Props) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'Terjadi kesalahan.');
      return false;
    }
    router.refresh();
    return true;
  }

  async function submitNew() {
    if (await call(`/api/posts/${postId}/comments`, 'POST', { content: text })) setText('');
  }
  async function submitReply(parentId: string) {
    if (await call(`/api/posts/${postId}/comments`, 'POST', { content: replyText, parentId })) {
      setReplyText('');
      setReplyTo(null);
    }
  }
  async function submitEdit(id: string) {
    if (await call(`/api/comments/${id}`, 'PATCH', { content: editText })) setEditing(null);
  }
  async function remove(id: string) {
    if (window.confirm('Hapus komentar ini? Balasan di bawahnya ikut terhapus.')) await call(`/api/comments/${id}`, 'DELETE');
  }
  async function report(id: string) {
    const reason = window.prompt('Kenapa komentar ini perlu ditinjau admin? (boleh dikosongkan)');
    if (reason === null) return;
    const ok = await call('/api/reports', 'POST', { targetType: 'comment', targetId: id, reason: reason.trim() || undefined });
    if (ok) window.alert('Terima kasih, laporanmu sudah diterima admin.');
  }

  function Name({ c }: { c: CommentData }) {
    if (anonymous && c.authorId === menteeId) return <span className="font-medium text-ink-900">Penanya (anonim)</span>;
    return <UserLink username={c.authorUsername} withAt={false} />;
  }

  function renderComment(c: CommentData, isReply: boolean) {
    const own = c.authorId === viewerId;
    return (
      <div key={c.id} className={isReply ? 'mt-4 border-l-2 border-ink-100 pl-4' : ''}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Name c={c} />
          {c.authorId === tentorId && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Tentor penjawab</span>
          )}
          {c.authorId === menteeId && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">Penanya</span>
          )}
          {c.isCorrection && !c.hidden && (
            <span className="flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
              <CheckCircle2 size={12} /> Dikoreksi / dilengkapi
            </span>
          )}
          <span className="text-xs text-ink-400">
            {formatTime(c.createdAt)}
            {c.editedAt ? ' · diedit' : ''}
          </span>
        </div>

        {c.hidden ? (
          <p className="mt-1 text-sm italic text-ink-400">Komentar ini disembunyikan oleh admin.</p>
        ) : editing === c.id ? (
          <div className="mt-2 space-y-2">
            <textarea className="input-field min-h-20 text-sm" value={editText} maxLength={1000} onChange={(e) => setEditText(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => submitEdit(c.id)} disabled={busy} className="btn-primary px-4 py-2 text-sm">Simpan</button>
              <button onClick={() => setEditing(null)} className="btn-secondary px-4 py-2 text-sm">Batal</button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-ink-800">{c.content}</p>
        )}

        {!c.hidden && editing !== c.id && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <button onClick={() => call(`/api/comments/${c.id}/like`, 'POST')} disabled={busy}
              className={`flex items-center gap-1 hover:text-brand-600 ${c.likedByMe ? 'font-semibold text-brand-600' : ''}`}>
              <Heart size={14} className={c.likedByMe ? 'fill-brand-500 text-brand-500' : ''} /> {c.likeCount > 0 ? c.likeCount : 'Suka'}
            </button>
            <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(''); }} className="flex items-center gap-1 hover:text-brand-600">
              <MessageSquare size={14} /> Balas
            </button>
            {own && (
              <>
                <button onClick={() => { setEditing(c.id); setEditText(c.content); }} className="flex items-center gap-1 hover:text-brand-600">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => remove(c.id)} className="flex items-center gap-1 hover:text-red-600">
                  <Trash2 size={14} /> Hapus
                </button>
              </>
            )}
            {viewerId === tentorId && !own && (
              <button onClick={() => call(`/api/comments/${c.id}/correction`, 'POST')} disabled={busy} className="flex items-center gap-1 hover:text-accent-700">
                <CheckCircle2 size={14} /> {c.isCorrection ? 'Lepas tanda koreksi' : 'Tandai dikoreksi / dilengkapi'}
              </button>
            )}
            {!own && (
              <button onClick={() => report(c.id)} className="flex items-center gap-1 hover:text-red-600">
                <Flag size={14} /> Laporkan
              </button>
            )}
          </div>
        )}

        {replyTo === c.id && (
          <div className="mt-3 space-y-2">
            <textarea className="input-field min-h-20 text-sm" value={replyText} maxLength={1000} placeholder="Tulis balasan…" onChange={(e) => setReplyText(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => submitReply(c.id)} disabled={busy || !replyText.trim()} className="btn-primary px-4 py-2 text-sm">Kirim balasan</button>
              <button onClick={() => setReplyTo(null)} className="btn-secondary px-4 py-2 text-sm">Batal</button>
            </div>
          </div>
        )}

        {!isReply && repliesOf(c.id).map((r) => renderComment(r, true))}
      </div>
    );
  }

  return (
    <section className="card mt-4">
      <h2 className="text-lg font-semibold text-ink-900">Forum diskusi {comments.length > 0 && <span className="text-ink-400">({comments.length})</span>}</h2>
      <p className="mt-1 text-sm text-ink-500">Tambahkan penjelasan, revisi, atau pertanyaan lanjutan. Tetap sopan dan fokus ke materi ya.</p>

      <div className="mt-4 space-y-2">
        <textarea className="input-field min-h-24" value={text} maxLength={1000} placeholder="Tulis komentar…" onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-400">{text.length}/1000</span>
          <button onClick={submitNew} disabled={busy || !text.trim()} className="btn-primary px-5 py-2.5 text-sm">
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Kirim komentar'}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-6">
        {roots.length === 0 ? (
          <p className="text-ink-400">Belum ada komentar. Jadilah yang pertama.</p>
        ) : (
          roots.map((c) => renderComment(c, false))
        )}
      </div>
    </section>
  );
}
