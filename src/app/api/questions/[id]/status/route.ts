import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Kabar jelas untuk mentee yang sedang menunggu: sudah ditawarkan ke berapa tentor,
 * berapa yang menolak, dan siapa yang menerima. Hanya peserta sesi yang boleh melihat.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await ctx.params;
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: 'Login dulu.' }, { status: 401 });

    const admin = createAdminClient();
    const { data: q } = await admin
      .from('questions')
      .select('id, mentee_id, accepted_tentor_id, status, expires_at, broadcast_round')
      .eq('id', questionId)
      .maybeSingle();

    if (!q) return NextResponse.json({ error: 'Pertanyaan tidak ditemukan.' }, { status: 404 });
    if (q.mentee_id !== session.profile.id && q.accepted_tentor_id !== session.profile.id) {
      return NextResponse.json({ error: 'Bukan sesimu.' }, { status: 403 });
    }

    const { data: rows } = await admin
      .from('question_assignments')
      .select('status')
      .eq('question_id', questionId);
    const list = rows ?? [];

    let tentorUsername: string | null = null;
    if (q.accepted_tentor_id) {
      const { data: t } = await admin
        .from('profiles')
        .select('username')
        .eq('id', q.accepted_tentor_id)
        .maybeSingle();
      tentorUsername = t?.username ?? null;
    }

    return NextResponse.json({
      status: q.status,
      offeredCount: list.length,
      pendingCount: list.filter((r) => r.status === 'menunggu').length,
      declinedCount: list.filter((r) => r.status === 'ditolak').length,
      round: q.broadcast_round,
      expiresAt: q.expires_at,
      tentorUsername,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
