import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

/** Bahan untuk tentor menyusun postingan: pertanyaan awal + semua pesan teks/foto di sesi (voice note tidak pernah ikut). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Postingan tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session || session.profile.role !== 'tentor') return fail('Hanya tentor penjawab yang bisa menyusun.', 403);

    const admin = createAdminClient();
    const { data: post } = await admin
      .from('session_posts')
      .select('id, question_id, mentee_id, tentor_id, status, anonymous, selected_message_ids, description, description_photos, show_question_photo, expires_at')
      .eq('id', id)
      .maybeSingle();
    if (!post || post.tentor_id !== session.profile.id) return fail('Postingan tidak ditemukan.', 404);
    if (post.status === 'ditarik' || post.status === 'kedaluwarsa') return fail('Postingan ini sudah tidak bisa disusun.', 410);
    if (post.status === 'menunggu_tentor' && new Date(post.expires_at).getTime() < Date.now()) {
      await admin.from('session_posts').update({ status: 'kedaluwarsa' }).eq('id', id);
      return fail('Waktu menyusun sudah lewat, sesi ini tetap privat.', 410);
    }

    const { data: question } = await admin
      .from('questions')
      .select('title, content, photo_url, tags, subjects(name)')
      .eq('id', post.question_id)
      .single();
    const { data: messages } = await admin
      .from('messages')
      .select('id, sender_id, type, content, created_at')
      .eq('question_id', post.question_id)
      .in('type', ['teks', 'foto'])
      .order('created_at', { ascending: true });
    const { data: mentee } = await admin.from('profiles').select('username').eq('id', post.mentee_id).maybeSingle();

    return NextResponse.json({
      post: {
        id: post.id,
        status: post.status,
        anonymous: post.anonymous,
        selectedMessageIds: post.selected_message_ids,
        description: post.description ?? '',
        descriptionPhotos: post.description_photos,
        showQuestionPhoto: post.show_question_photo,
        expiresAt: post.expires_at,
      },
      question,
      messages: messages ?? [],
      menteeId: post.mentee_id,
      menteeUsername: mentee?.username ?? 'mentee',
    });
  } catch (err) {
    return unexpected(err);
  }
}
