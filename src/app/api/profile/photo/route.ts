import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BYTES = 300 * 1024; // browser sudah mengecilkan jadi puluhan KB; ini batas pengaman
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

function unexpected(err: unknown) {
  return NextResponse.json(
    { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
    { status: 500 }
  );
}

async function clearOldPhotos(userId: string) {
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from('avatars').list(userId);
  if (files && files.length > 0) {
    await admin.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: 'Login dulu.' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'File foto tidak ditemukan.' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Format foto harus JPG, PNG, atau WebP.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ukuran foto terlalu besar (maksimal 300 KB).' }, { status: 400 });
    }

    const admin = createAdminClient();
    await clearOldPhotos(session.profile.id);

    const path = `${session.profile.id}/avatar-${Date.now()}.jpg`;
    const { error: uploadErr } = await admin.storage
      .from('avatars')
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (uploadErr) {
      return NextResponse.json({ error: 'Gagal upload foto: ' + uploadErr.message }, { status: 500 });
    }

    const photoUrl = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error } = await admin.from('profiles').update({ photo_url: photoUrl }).eq('id', session.profile.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ photoUrl });
  } catch (err) {
    return unexpected(err);
  }
}

export async function DELETE() {
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: 'Login dulu.' }, { status: 401 });

    const admin = createAdminClient();
    await clearOldPhotos(session.profile.id);
    const { error } = await admin.from('profiles').update({ photo_url: null }).eq('id', session.profile.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}
