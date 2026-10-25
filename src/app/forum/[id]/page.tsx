/* eslint-disable @next/next/no-img-element */
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { BadgeCheck, ImageIcon } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { UserLink } from '@/components/UserLink';
import { PostActions } from '@/components/PostActions';
import { CommentSection, type CommentData } from '@/components/CommentSection';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';

export const dynamic = 'force-dynamic';

interface CommentRow {
  id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  is_correction: boolean;
  hidden: boolean;
  created_at: string;
  edited_at: string | null;
  author: { username: string } | null;
}

export default async function ForumPostPage({ params }: { params: { id: string } }) {
  const session = await getSessionProfile();
  if (!session) redirect(`/masuk?redirect=${encodeURIComponent(`/forum/${params.id}`)}`);
  if (!UUID_RE.test(params.id)) notFound();

  const admin = createAdminClient();
  const { data: post } = await admin
    .from('session_posts')
    .select('id, question_id, mentee_id, tentor_id, status, anonymous, selected_message_ids, description, description_photos, show_question_photo, mentee_seen, published_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!post) notFound();

  const viewerId = session.profile.id;
  const isMentee = viewerId === post.mentee_id;
  const isTentor = viewerId === post.tentor_id;
  const isParticipant = isMentee || isTentor;

  // Selain peserta sesi, hanya postingan yang sedang tayang yang boleh dilihat
  if (post.status !== 'tayang' && !isParticipant) notFound();
  if (post.status === 'menunggu_tentor' && isTentor) redirect(`/forum/${post.id}/susun`);

  const [{ data: tentorProfile }, { data: menteeProfile }] = await Promise.all([
    admin.from('profiles').select('username').eq('id', post.tentor_id).maybeSingle(),
    admin.from('profiles').select('username').eq('id', post.mentee_id).maybeSingle(),
  ]);
  const tentorName = tentorProfile?.username ?? 'tentor';
  const menteeName = menteeProfile?.username ?? 'mentee';

  // Keadaan khusus untuk peserta sesi
  if (post.status !== 'tayang') {
    const text =
      post.status === 'menunggu_tentor'
        ? 'Sesi ini sudah kamu setujui untuk dipublikasikan. Kamu akan dapat notifikasi begitu tentor selesai menyusunnya.'
        : post.status === 'ditarik'
          ? 'Postingan ini sudah ditarik, jadi sesinya kembali privat.'
          : 'Waktu menyusun postingan ini sudah lewat, jadi sesinya tetap privat.';
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <p className="card text-ink-600">{text}</p>
          <Link href="/dashboard" className="btn-secondary mt-6">Kembali ke dashboard</Link>
        </main>
        <Footer />
      </>
    );
  }

  // Mentee yang membuka postingannya: notifikasi "sudah tayang" dianggap sudah dilihat
  if (isMentee && !post.mentee_seen) {
    await admin.from('session_posts').update({ mentee_seen: true }).eq('id', post.id);
  }

  const { data: question } = await admin
    .from('questions')
    .select('title, content, photo_url, tags, subjects(name)')
    .eq('id', post.question_id)
    .single();
  const q = question as unknown as {
    title: string | null;
    content: string;
    photo_url: string | null;
    tags: string[] | null;
    subjects: { name: string } | null;
  } | null;

  const selectedIds = (post.selected_message_ids as string[] | null) ?? [];
  const { data: messageRows } = selectedIds.length
    ? await admin
        .from('messages')
        .select('id, sender_id, type, content, created_at')
        .in('id', selectedIds)
        .in('type', ['teks', 'foto'])
        .order('created_at', { ascending: true })
    : { data: [] };
  const messages = (messageRows ?? []) as { id: string; sender_id: string; type: 'teks' | 'foto'; content: string; created_at: string }[];

  const { data: commentRows } = await admin
    .from('post_comments')
    .select('id, parent_id, author_id, content, is_correction, hidden, created_at, edited_at, author:profiles!author_id(username)')
    .eq('post_id', post.id)
    .order('created_at', { ascending: true });
  const rawComments = (commentRows ?? []) as unknown as CommentRow[];

  const commentIds = rawComments.map((c) => c.id);
  const { data: likeRows } = commentIds.length
    ? await admin.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
    : { data: [] };
  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of (likeRows ?? []) as { comment_id: string; user_id: string }[]) {
    likeCount.set(l.comment_id, (likeCount.get(l.comment_id) ?? 0) + 1);
    if (l.user_id === viewerId) likedByMe.add(l.comment_id);
  }
  const comments: CommentData[] = rawComments.map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    authorId: c.author_id,
    // Penanya anonim: nama aslinya tidak ikut dikirim ke browser sama sekali
    authorUsername: post.anonymous && c.author_id === post.mentee_id ? 'anonim' : c.author?.username ?? 'pengguna',
    content: c.hidden ? '' : c.content,
    isCorrection: c.is_correction,
    hidden: c.hidden,
    createdAt: c.created_at,
    editedAt: c.edited_at,
    likeCount: likeCount.get(c.id) ?? 0,
    likedByMe: likedByMe.has(c.id),
  }));

  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const topic = [q?.subjects?.name, ...(q?.tags ?? [])].filter(Boolean).join(' · ');

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="card">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <BadgeCheck size={14} /> Disetujui
            </span>
            <PostActions postId={post.id} isParticipant={isParticipant} />
          </div>

          <h1 className="mt-4 text-2xl font-semibold leading-snug text-ink-900">{q?.title || 'Tanpa judul'}</h1>
          {topic && <p className="mt-2 text-sm text-ink-500">Topik: {topic}</p>}
          <p className="mt-1 text-sm text-ink-500">
            Ditanya oleh {post.anonymous ? 'Anonim' : <UserLink username={menteeName} className="text-sm" />}
            {' · dijawab oleh '}
            <UserLink username={tentorName} className="text-sm" />
            {publishedDate && ` · ${publishedDate}`}
          </p>

          <hr className="my-5 border-ink-100" />

          <h2 className="font-semibold text-ink-900">Pertanyaan utama</h2>
          <p className="mt-2 whitespace-pre-wrap text-ink-800">{q?.content}</p>
          {post.show_question_photo && q?.photo_url && (
            <img src={q.photo_url} alt="Foto soal" className="mt-3 max-h-80 rounded-2xl object-cover" />
          )}

          {messages.length > 0 && (
            <>
              <h2 className="mt-6 font-semibold text-ink-900">Pembahasan</h2>
              <ul className="mt-3 space-y-3">
                {messages.map((m) => {
                  const fromTentor = m.sender_id === post.tentor_id;
                  return (
                    <li key={m.id} className={`rounded-2xl px-4 py-3 ${fromTentor ? 'bg-brand-50' : 'bg-ink-50'}`}>
                      <p className="mb-1 text-xs font-semibold text-ink-500">
                        {fromTentor ? `Tentor @${tentorName}` : post.anonymous ? 'Penanya' : `Penanya @${menteeName}`}
                      </p>
                      {m.type === 'teks' ? (
                        <p className="whitespace-pre-wrap text-ink-800">{m.content}</p>
                      ) : (
                        <img src={m.content} alt="Foto dari chat" className="max-h-72 rounded-xl object-cover" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <h2 className="mt-6 flex items-center gap-2 font-semibold text-ink-900">
            <ImageIcon size={16} className="text-ink-400" /> Penjelasan tambahan dari tentor
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-ink-800">{post.description}</p>
          {((post.description_photos as string[] | null) ?? []).length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(post.description_photos as string[]).map((url) => (
                <img key={url} src={url} alt="Foto penjelasan" className="rounded-2xl object-cover" />
              ))}
            </div>
          )}

          <hr className="my-5 border-ink-100" />
          <p className="text-xs text-ink-500">
            Pembahasan diambil dari percakapan sesi dan dipublikasikan atas persetujuan mentee serta tentor. Isi pesan tidak diubah.
          </p>
        </article>

        <CommentSection
          postId={post.id}
          viewerId={viewerId}
          tentorId={post.tentor_id}
          menteeId={post.mentee_id}
          anonymous={post.anonymous}
          comments={comments}
        />
      </main>
      <Footer />
    </>
  );
}
