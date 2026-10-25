import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { fail, unexpected } from '@/lib/api';

const MAX_BYTES = 900 * 1024; // browser sudah mengecilkan foto; ini batas pengaman
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail('Postingan tidak ditemukan.', 404);
    const session = await getSessionProfile();
    if (!session || session.profile.role !== 'tentor') return fail('Tidak diizinkan.', 403);

    const admin = createAdminClient();
    const { data: post } = await admin
      .from('session_posts')
      .select('tentor_id, status')
      .eq('id', id)
      .maybeSingle();
    if (!post || post.tentor_id !== session.profile.id) return fail('Postingan tidak ditemukan.', 404);
    if (post.status !== 'menunggu_tentor' && post.status !== 'tayang') return fail('Postingan ini sudah tidak bisa diubah.', 409);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) return fail('File foto tidak ditemukan.', 400);
    if (!ALLOWED.includes(file.type)) return fail('Format foto harus JPG, PNG, atau WebP.', 400);
    if (file.size > MAX_BYTES) return fail('Ukuran foto terlalu besar.', 400);

    const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await admin.storage.from('post-photos').upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (error) return fail('Gagal upload foto: ' + error.message, 500);

    const url = admin.storage.from('post-photos').getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (err) {
    return unexpected(err);
  }
}
