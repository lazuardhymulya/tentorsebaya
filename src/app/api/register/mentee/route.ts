import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPassword, verifyPassword } from '@/lib/password';
import { USERNAME_HINT, USERNAME_REGEX } from '@/lib/profile';

const schema = z.object({
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .max(30, 'Username maksimal 30 karakter')
    .regex(USERNAME_REGEX, USERNAME_HINT),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

async function handlePost(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Kamu belum login dengan Google.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, username, password_hash, role')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.role !== 'mentee') {
      return NextResponse.json(
        { error: 'Akun Google ini terdaftar sebagai tentor, bukan mentee.' },
        { status: 409 }
      );
    }
    if (existingProfile.username !== username) {
      return NextResponse.json({ error: 'Username tidak cocok dengan akun ini.' }, { status: 401 });
    }
    const valid = await verifyPassword(password, existingProfile.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Password salah.' }, { status: 401 });
    }
    return NextResponse.json({ status: 'login' });
  }

  const { data: usernameTaken } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (usernameTaken) {
    return NextResponse.json({ error: 'Username sudah dipakai, pilih yang lain.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const { error } = await admin.from('profiles').insert({
    id: user.id,
    role: 'mentee',
    username,
    password_hash: passwordHash,
    full_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
  });

  if (error) {
    return NextResponse.json({ error: 'Gagal membuat profil: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'registered' });
}
