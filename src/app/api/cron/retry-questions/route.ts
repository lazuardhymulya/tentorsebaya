import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fillBroadcastSlots } from '@/lib/broadcast';
import { RESEND_INTERVAL_MS, QUESTION_EXPIRY_MS, SESSION_AUTO_CLOSE_MS } from '@/lib/matching';

/**
 * Dipanggil berkala oleh Supabase Cron (pg_cron + pg_net) — LIHAT README,
 * bagian "Jadwalkan cron job" untuk cara mendaftarkannya. Tidak memakai
 * Vercel Cron karena paket gratisnya cuma boleh jalan 1x/hari, terlalu
 * jarang untuk kebutuhan rotasi per jam di sini.
 */
export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (err) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

async function handleGet(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const result = { autoClosed: 0, expired: 0, rotated: 0, toppedUp: 0, checked: 0 };

  // 1) Sesi aktif ('berjalan') yang mentee-nya tidak pernah mengakhiri >24 jam
  //    -> tutup otomatis, rating dianggap 3.0 (ditangani trigger DB lewat rating_given = null).
  const { data: staleSessions } = await admin
    .from('questions')
    .select('id')
    .eq('status', 'berjalan')
    .lt('accepted_at', new Date(now - SESSION_AUTO_CLOSE_MS).toISOString());

  for (const s of staleSessions ?? []) {
    await admin
      .from('questions')
      .update({ status: 'selesai', ended_at: new Date().toISOString(), auto_closed: true })
      .eq('id', s.id)
      .eq('status', 'berjalan');
    result.autoClosed++;
  }

  // 2) Pertanyaan yang masih menunggu tentor
  const { data: pending } = await admin
    .from('questions')
    .select('id, subject_id, created_at, last_broadcast_at, broadcast_round')
    .eq('status', 'menunggu');

  result.checked = pending?.length ?? 0;

  for (const q of pending ?? []) {
    const createdMs = new Date(q.created_at).getTime();

    // 2a) Lewat 24 jam sejak diupload & tetap tidak ada yang menerima -> hangus
    if (now - createdMs >= QUESTION_EXPIRY_MS) {
      await admin.from('questions').update({ status: 'hangus' }).eq('id', q.id).eq('status', 'menunggu');
      result.expired++;
      continue;
    }

    // 2b) Lewat 1 jam sejak broadcast terakhir tanpa ada yang menerima ->
    //     tawaran yang masih menggantung jadi "terlambat", mulai putaran baru
    const lastBroadcastMs = new Date(q.last_broadcast_at).getTime();
    if (now - lastBroadcastMs >= RESEND_INTERVAL_MS) {
      await admin
        .from('question_assignments')
        .update({ status: 'terlambat', responded_at: new Date().toISOString() })
        .eq('question_id', q.id)
        .eq('status', 'menunggu');

      await admin
        .from('questions')
        .update({
          last_broadcast_at: new Date().toISOString(),
          broadcast_round: (q.broadcast_round ?? 1) + 1,
        })
        .eq('id', q.id);

      result.rotated++;
    }

    // 2c) Isi slot yang masih kosong (maksimal 5) — ini juga yang menangani
    //     pemantauan berkelanjutan untuk kasus tentor cocok < 5 orang.
    const { assignedTentorIds } = await fillBroadcastSlots(admin, {
      id: q.id,
      subject_id: q.subject_id,
    });
    if (assignedTentorIds.length > 0) result.toppedUp++;
  }

  return NextResponse.json({ status: 'ok', ...result });
}
