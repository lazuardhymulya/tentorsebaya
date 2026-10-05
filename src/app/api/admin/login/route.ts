import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSession } from '@/lib/admin-session';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return NextResponse.json(
      { error: 'ADMIN_USERNAME/ADMIN_PASSWORD belum diisi di environment variable.' },
      { status: 500 }
    );
  }

  if (username !== validUsername || password !== validPassword) {
    return NextResponse.json({ error: 'Username atau password admin salah.' }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ status: 'ok' });
}
