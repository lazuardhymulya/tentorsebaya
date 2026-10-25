import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

/** Tombol suka: sekali tekan menyukai, tekan lagi membatalkan. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Komentar tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session) return fail('Login dulu.', 401);

    const admin = createAdminClient();
    const { data: comment } = await admin.from('post_comments').select('id').eq('id', id).maybeSingle();
    if (!comment) return fail('Komentar tidak ditemukan.', 404);

    const { data: existing } = await admin
      .from('comment_likes')
      .select('comment_id')
      .eq('comment_id', id)
      .eq('user_id', session.profile.id)
      .maybeSingle();

    if (existing) {
      await admin.from('comment_likes').delete().eq('comment_id', id).eq('user_id', session.profile.id);
    } else {
      await admin.from('comment_likes').insert({ comment_id: id, user_id: session.profile.id });
    }
    return NextResponse.json({ liked: !existing });
  } catch (err) {
    return unexpected(err);
  }
}
