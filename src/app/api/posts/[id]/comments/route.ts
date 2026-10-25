import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

const schema = z.object({
  content: z.string().trim().min(1, 'Komentar tidak boleh kosong.').max(1000, 'Komentar maksimal 1000 karakter.'),
  parentId: z.string().uuid().optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Postingan tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session) return fail('Login dulu untuk berkomentar.', 401);

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);

    const admin = createAdminClient();
    const { data: post } = await admin.from('session_posts').select('status').eq('id', id).maybeSingle();
    if (!post || post.status !== 'tayang') return fail('Postingan tidak ditemukan.', 404);

    // Pengaman spam sederhana: jeda minimal 5 detik antar komentar per pengguna
    const { data: last } = await admin
      .from('post_comments')
      .select('created_at')
      .eq('author_id', session.profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < 5000) {
      return fail('Terlalu cepat, tunggu beberapa detik sebelum berkomentar lagi.', 429);
    }

    // Balasan hanya satu tingkat: membalas balasan = menempel ke komentar induknya
    let parentId: string | null = null;
    if (parsed.data.parentId) {
      const { data: parent } = await admin
        .from('post_comments')
        .select('id, post_id, parent_id')
        .eq('id', parsed.data.parentId)
        .maybeSingle();
      if (!parent || parent.post_id !== id) return fail('Komentar yang dibalas tidak ditemukan.', 404);
      parentId = (parent.parent_id as string | null) ?? (parent.id as string);
    }

    const { error } = await admin.from('post_comments').insert({
      post_id: id,
      author_id: session.profile.id,
      parent_id: parentId,
      content: parsed.data.content,
    });
    if (error) return fail(error.message, 500);

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}
