import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

/** Mentee atau tentor penjawab bisa menarik postingan kapan saja; sesinya kembali privat. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Postingan tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session) return fail('Login dulu.', 401);

    const admin = createAdminClient();
    const { data: post } = await admin
      .from('session_posts')
      .select('mentee_id, tentor_id, status')
      .eq('id', id)
      .maybeSingle();
    if (!post) return fail('Postingan tidak ditemukan.', 404);
    if (post.mentee_id !== session.profile.id && post.tentor_id !== session.profile.id) {
      return fail('Hanya mentee atau tentor penjawab yang bisa menarik postingan.', 403);
    }
    if (post.status !== 'tayang' && post.status !== 'menunggu_tentor') return fail('Postingan sudah tidak aktif.', 409);

    const { error } = await admin
      .from('session_posts')
      .update({ status: 'ditarik', withdrawn_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return fail(error.message, 500);

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}
