import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

const schema = z.object({
  selectedMessageIds: z.array(z.string().uuid()).max(100),
  description: z.string().trim().min(10, 'Penjelasan tambahan minimal 10 karakter.').max(3000, 'Penjelasan maksimal 3000 karakter.'),
  photos: z.array(z.string().url()).max(3, 'Maksimal 3 foto.'),
  showQuestionPhoto: z.boolean(),
});

/** Tentor menayangkan postingan. Isi pesan TIDAK bisa diubah: tentor hanya memilih ID pesan yang ditampilkan. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Postingan tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session || session.profile.role !== 'tentor') return fail('Hanya tentor penjawab yang bisa menayangkan.', 403);

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);
    const input = parsed.data;

    const admin = createAdminClient();
    const { data: post } = await admin
      .from('session_posts')
      .select('id, question_id, tentor_id, status, expires_at, published_at')
      .eq('id', id)
      .maybeSingle();
    if (!post || post.tentor_id !== session.profile.id) return fail('Postingan tidak ditemukan.', 404);
    if (post.status !== 'menunggu_tentor' && post.status !== 'tayang') return fail('Postingan ini sudah tidak bisa diubah.', 409);
    if (post.status === 'menunggu_tentor' && new Date(post.expires_at).getTime() < Date.now()) {
      await admin.from('session_posts').update({ status: 'kedaluwarsa' }).eq('id', id);
      return fail('Waktu menyusun sudah lewat, sesi ini tetap privat.', 410);
    }

    // Pesan yang dipilih harus benar-benar milik sesi ini dan bertipe teks/foto
    if (input.selectedMessageIds.length > 0) {
      const { data: valid } = await admin
        .from('messages')
        .select('id')
        .eq('question_id', post.question_id)
        .in('type', ['teks', 'foto'])
        .in('id', input.selectedMessageIds);
      if ((valid ?? []).length !== new Set(input.selectedMessageIds).size) {
        return fail('Ada pesan yang tidak valid untuk ditayangkan.', 400);
      }
    }
    // Foto penjelasan harus hasil upload ke postingan ini
    const photoMarker = `/post-photos/${id}/`;
    if (input.photos.some((url) => !url.includes(photoMarker))) return fail('Foto tidak valid.', 400);

    const firstTime = post.status === 'menunggu_tentor';
    const { error } = await admin
      .from('session_posts')
      .update({
        status: 'tayang',
        selected_message_ids: Array.from(new Set(input.selectedMessageIds)),
        description: input.description,
        description_photos: input.photos,
        show_question_photo: input.showQuestionPhoto,
        ...(firstTime ? { published_at: new Date().toISOString(), mentee_seen: false } : {}),
      })
      .eq('id', id);
    if (error) return fail(error.message, 500);

    return NextResponse.json({ status: 'ok', postId: id });
  } catch (err) {
    return unexpected(err);
  }
}
