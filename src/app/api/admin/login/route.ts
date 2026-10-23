import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSession } from '@/lib/admin-session';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    const { username, password } = parsed.data;
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (!validUsername || !validPassword || !process.env.ADMIN_SESSION_SECRET) {
      return NextResponse.json(
        {
          error:
            'ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SESSION_SECRET belum terisi lengkap di .env.local. Setelah mengedit .env.local, server dev perlu dimatikan (Ctrl+C) lalu dijalankan ulang (npm run dev) supaya perubahannya kepakai.',
        },
        { status: 500 }
      );
    }

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json({ error: 'Username atau password admin salah.' }, { status: 401 });
    }

    await createAdminSession();
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan tak terduga di server: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
