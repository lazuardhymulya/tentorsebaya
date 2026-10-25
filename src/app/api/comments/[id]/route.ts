import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

const schema = z.object({
  content: z.string().trim().min(1, 'Komentar tidak boleh kosong.').max(1000, 'Komentar maksimal 1000 karakter.'),
});

/** Penulis mengedit komentarnya sendiri. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Komentar tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session) return fail('Login dulu.', 401);

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);

    const admin = createAdminClient();
    const { data: comment } = await admin.from('post_comments').select('author_id, hidden').eq('id', id).maybeSingle();
    if (!comment) return fail('Komentar tidak ditemukan.', 404);
    if (comment.author_id !== session.profile.id) return fail('Hanya penulisnya yang bisa mengedit.', 403);
    if (comment.hidden) return fail('Komentar ini disembunyikan admin.', 409);

    const { error } = await admin
      .from('post_comments')
      .update({ content: parsed.data.content, edited_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}

/** Penulis menghapus komentarnya sendiri (balasan di bawahnya ikut terhapus). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Komentar tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session) return fail('Login dulu.', 401);

    const admin = createAdminClient();
    const { data: comment } = await admin.from('post_comments').select('author_id').eq('id', id).maybeSingle();
    if (!comment) return fail('Komentar tidak ditemukan.', 404);
    if (comment.author_id !== session.profile.id) return fail('Hanya penulisnya yang bisa menghapus.', 403);

    const { error } = await admin.from('post_comments').delete().eq('id', id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}
