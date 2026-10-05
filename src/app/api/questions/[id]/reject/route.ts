import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: questionId } = await params;
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'tentor') {
    return NextResponse.json({ error: 'Hanya tentor yang bisa menolak pertanyaan.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('question_assignments')
    .update({ status: 'ditolak', responded_at: new Date().toISOString() })
    .eq('question_id', questionId)
    .eq('tentor_id', session.profile.id)
    .eq('status', 'menunggu')
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Tawaran ini sudah tidak berlaku.' }, { status: 409 });

  return NextResponse.json({ status: 'ok' });
}
