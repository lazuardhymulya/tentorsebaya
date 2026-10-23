import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({ isAvailable: z.boolean() });

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
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'tentor') {
    return NextResponse.json({ error: 'Hanya tentor yang punya status tersedia.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parameter tidak valid.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tentor_profiles')
    .update({ is_available: parsed.data.isAvailable })
    .eq('profile_id', session.profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok' });
}
