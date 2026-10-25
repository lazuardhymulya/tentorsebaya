import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

/** Tentor penjawab menandai komentar orang lain sebagai "dikoreksi / dilengkapi" (tekan lagi untuk melepas). */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Komentar tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session) return fail('Login dulu.', 401);

    const admin = createAdminClient();
    const { data: comment } = await admin
      .from('post_comments')
      .select('id, post_id, author_id, is_correction')
      .eq('id', id)
      .maybeSingle();
    if (!comment) return fail('Komentar tidak ditemukan.', 404);

    const { data: post } = await admin.from('session_posts').select('tentor_id').eq('id', comment.post_id).maybeSingle();
    if (!post || post.tentor_id !== session.profile.id) return fail('Hanya tentor penjawab yang bisa menandai.', 403);
    if (comment.author_id === session.profile.id) return fail('Komentarmu sendiri tidak perlu ditandai.', 400);

    const { error } = await admin.from('post_comments').update({ is_correction: !comment.is_correction }).eq('id', id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ isCorrection: !comment.is_correction });
  } catch (err) {
    return unexpected(err);
  }
}
