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
  kelas: z.string().min(1).optional(),
  accessCode: z.string().optional(),
  subjectIds: z.array(z.string().uuid()).optional(),
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
  const { username, password, kelas, accessCode, subjectIds } = parsed.data;

  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, username, password_hash, role')
    .eq('id', user.id)
    .maybeSingle();

  // --- Kasus 1: sudah pernah daftar sebelumnya -> ini login, bukan daftar ---
  if (existingProfile) {
    if (existingProfile.role !== 'tentor') {
      return NextResponse.json(
        { error: 'Akun Google ini terdaftar sebagai mentee, bukan tentor.' },
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
    return NextResponse.json({ status: 'login', needsRegistration: false });
  }

  // --- Kasus 2: belum pernah daftar -> wajib isi kelas + kode akses + mapel ---
  if (!kelas || !accessCode || !subjectIds || subjectIds.length === 0) {
    return NextResponse.json(
      { error: 'Kelas, kode akses, dan minimal 1 mapel wajib diisi untuk pendaftaran pertama.' },
      { status: 400 }
    );
  }

  const { data: usernameTaken } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (usernameTaken) {
    return NextResponse.json({ error: 'Username sudah dipakai, pilih yang lain.' }, { status: 409 });
  }

  const { data: code } = await admin
    .from('access_codes')
    .select('id, usage_limit, usage_count')
    .eq('code', accessCode)
    .maybeSingle();

  if (!code) {
    return NextResponse.json({ error: 'Kode akses tidak ditemukan.' }, { status: 404 });
  }
  if (code.usage_count >= code.usage_limit) {
    return NextResponse.json({ error: 'Kode akses sudah habis dipakai.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const { error: profileErr } = await admin.from('profiles').insert({
    id: user.id,
    role: 'tentor',
    username,
    password_hash: passwordHash,
    full_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
  });
  if (profileErr) {
    return NextResponse.json({ error: 'Gagal membuat profil: ' + profileErr.message }, { status: 500 });
  }

  const { error: tentorErr } = await admin.from('tentor_profiles').insert({
    profile_id: user.id,
    kelas,
    access_code_verified: true,
    access_code_id: code.id,
  });
  if (tentorErr) {
    return NextResponse.json({ error: 'Gagal membuat profil tentor: ' + tentorErr.message }, { status: 500 });
  }

  const { error: subjectsErr } = await admin
    .from('tentor_subjects')
    .insert(subjectIds.map((subject_id) => ({ tentor_id: user.id, subject_id })));
  if (subjectsErr) {
    return NextResponse.json({ error: 'Gagal menyimpan mapel: ' + subjectsErr.message }, { status: 500 });
  }

  await admin
    .from('access_codes')
    .update({ usage_count: code.usage_count + 1 })
    .eq('id', code.id);

  return NextResponse.json({ status: 'registered', needsRegistration: false });
}
