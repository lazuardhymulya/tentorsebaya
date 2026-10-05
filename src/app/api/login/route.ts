import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/password';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sesi Google sudah habis, ulangi login.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, password_hash, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Akun ini belum terdaftar.' }, { status: 404 });
  }
  if (profile.username !== parsed.data.username) {
    return NextResponse.json({ error: 'Username tidak cocok dengan akun ini.' }, { status: 401 });
  }
  const valid = await verifyPassword(parsed.data.password, profile.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Password salah.' }, { status: 401 });
  }

  return NextResponse.json({ status: 'ok', role: profile.role });
}
