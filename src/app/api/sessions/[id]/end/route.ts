import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  rating: z.number().min(0.1).max(5.0),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: questionId } = await params;
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'mentee') {
    return NextResponse.json({ error: 'Hanya mentee yang bisa mengakhiri sesi.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bintang wajib diisi (0.1 - 5.0).' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('questions')
    .update({
      status: 'selesai',
      ended_at: new Date().toISOString(),
      rating_given: parsed.data.rating,
      auto_closed: false,
    })
    .eq('id', questionId)
    .eq('mentee_id', session.profile.id)
    .eq('status', 'berjalan')
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: 'Sesi ini tidak ditemukan atau sudah selesai.' }, { status: 409 });
  }

  return NextResponse.json({ question: data });
}
