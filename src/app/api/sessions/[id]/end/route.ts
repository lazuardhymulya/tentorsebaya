import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  rating: z.number().min(0.1).max(5.0),
  // Ulasan teks opsional; bintang tetap wajib
  review: z.string().trim().max(500, 'Ulasan maksimal 500 karakter.').optional(),
  // Persetujuan mentee agar sesi ini boleh dipublikasikan ke forum (tentor yang menyusunnya)
  publish: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await handlePost(request, ctx);
  } catch (err) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

async function handlePost(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: questionId } = await params;
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'mentee') {
    return NextResponse.json({ error: 'Hanya mentee yang bisa mengakhiri sesi.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Bintang wajib diisi (0.1 - 5.0).' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const baseUpdate = {
    status: 'selesai',
    ended_at: new Date().toISOString(),
    rating_given: parsed.data.rating,
    auto_closed: false,
  };
  const endSession = (values: Record<string, unknown>) =>
    admin
      .from('questions')
      .update(values)
      .eq('id', questionId)
      .eq('mentee_id', session.profile.id)
      .eq('status', 'berjalan')
      .select()
      .maybeSingle();

  // gift_pending = penanda kado untuk tentor (migrasi 0006). Kalau migrasinya belum
  // dijalankan, sesi tetap harus bisa diakhiri, jadi coba lagi tanpa kolom itu.
  let result = await endSession({ ...baseUpdate, gift_pending: true });
  if (result.error && /gift_pending/i.test(result.error.message)) {
    result = await endSession(baseUpdate);
  }
  const { data, error } = result;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: 'Sesi ini tidak ditemukan atau sudah selesai.' }, { status: 409 });
  }

  // Simpan ulasan teks (kalau diisi) supaya tampil di profil tentor.
  // Kegagalan di sini tidak membatalkan sesi yang sudah resmi selesai.
  let reviewSaved = false;
  const reviewText = parsed.data.review?.trim();
  if (reviewText && data.accepted_tentor_id) {
    const { error: reviewErr } = await admin.from('tentor_reviews').insert({
      question_id: questionId,
      tentor_id: data.accepted_tentor_id,
      mentee_id: session.profile.id,
      rating: parsed.data.rating,
      review_text: reviewText,
    });
    reviewSaved = !reviewErr;
  }

  // Mentee setuju sesi dipublikasikan -> buat permintaan menyusun untuk tentor (berlaku 7 hari)
  let publishRequested = false;
  if (parsed.data.publish && data.accepted_tentor_id) {
    const { error: postErr } = await admin.from('session_posts').insert({
      question_id: questionId,
      mentee_id: session.profile.id,
      tentor_id: data.accepted_tentor_id,
      anonymous: parsed.data.anonymous ?? false,
    });
    publishRequested = !postErr;
  }

  return NextResponse.json({ question: data, reviewSaved, publishRequested });
}
