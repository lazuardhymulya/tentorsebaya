import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fail, unexpected } from '@/lib/api';

const schema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().uuid(),
  reason: z.string().trim().max(300, 'Alasan maksimal 300 karakter.').optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session) return fail('Login dulu.', 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);
    const { targetType, targetId, reason } = parsed.data;

    const admin = createAdminClient();
    if (targetType === 'comment') {
      const { data: c } = await admin.from('post_comments').select('author_id').eq('id', targetId).maybeSingle();
      if (!c) return fail('Komentar tidak ditemukan.', 404);
      if (c.author_id === session.profile.id) return fail('Kamu tidak bisa melaporkan komentarmu sendiri.', 400);
    } else {
      const { data: p } = await admin.from('session_posts').select('mentee_id, tentor_id').eq('id', targetId).maybeSingle();
      if (!p) return fail('Postingan tidak ditemukan.', 404);
      if (p.mentee_id === session.profile.id || p.tentor_id === session.profile.id) {
        return fail('Kamu bisa menarik postinganmu sendiri lewat tombol Tarik postingan.', 400);
      }
    }

    const { error } = await admin
      .from('content_reports')
      .insert({ reporter_id: session.profile.id, target_type: targetType, target_id: targetId, reason: reason || null });
    // Laporan ganda dari orang yang sama dianggap sudah diterima (unik per pelapor + target)
    if (error && error.code !== '23505') return fail(error.message, 500);

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}
