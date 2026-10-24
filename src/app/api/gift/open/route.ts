import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({ questionId: z.string().uuid() });

/** Tentor menutup kadonya -> penanda kado belum dibuka dimatikan. */
export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session || session.profile.role !== 'tentor') {
      return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from('questions')
      .update({ gift_pending: false })
      .eq('id', parsed.data.questionId)
      .eq('accepted_tentor_id', session.profile.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
