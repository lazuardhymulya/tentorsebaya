import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await handlePost(ctx);
  } catch (err) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

async function handlePost({ params }: { params: Promise<{ id: string }> }) {
  const { id: questionId } = await params;
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'tentor') {
    return NextResponse.json({ error: 'Hanya tentor yang bisa menerima pertanyaan.' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: assignment } = await admin
    .from('question_assignments')
    .select('id, status')
    .eq('question_id', questionId)
    .eq('tentor_id', session.profile.id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: 'Pertanyaan ini tidak ditawarkan ke kamu.' }, { status: 404 });
  }
  if (assignment.status !== 'menunggu') {
    return NextResponse.json({ error: 'Tawaran ini sudah tidak berlaku.' }, { status: 409 });
  }

  // Update kondisional: hanya berhasil kalau pertanyaannya MASIH 'menunggu'.
  // Ini kunci mekanisme "first accept wins" — siapa yang query-nya sukses duluan, dialah pemenangnya.
  const { data: won, error: winErr } = await admin
    .from('questions')
    .update({
      status: 'berjalan',
      accepted_tentor_id: session.profile.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .eq('status', 'menunggu')
    .select()
    .maybeSingle();

  if (winErr) {
    return NextResponse.json({ error: winErr.message }, { status: 500 });
  }
  if (!won) {
    // Kalah cepat dari tentor lain
    await admin
      .from('question_assignments')
      .update({ status: 'terlambat', responded_at: new Date().toISOString() })
      .eq('id', assignment.id);
    return NextResponse.json({ error: 'Yah, sudah diambil tentor lain. Coba pertanyaan lainnya ya.' }, { status: 409 });
  }

  await admin
    .from('question_assignments')
    .update({ status: 'diterima', responded_at: new Date().toISOString() })
    .eq('id', assignment.id);

  // Tawaran ke tentor lain untuk pertanyaan yang sama otomatis basi
  await admin
    .from('question_assignments')
    .update({ status: 'terlambat', responded_at: new Date().toISOString() })
    .eq('question_id', questionId)
    .eq('status', 'menunggu');

  await admin
    .from('tentor_profiles')
    .update({ is_teaching: true })
    .eq('profile_id', session.profile.id);

  return NextResponse.json({ question: won });
}
