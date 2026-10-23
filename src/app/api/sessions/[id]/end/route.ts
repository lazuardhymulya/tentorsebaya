import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  rating: z.number().min(0.1).max(5.0),
  // Ulasan teks opsional; bintang tetap wajib
  review: z.string().trim().max(500, 'Ulasan maksimal 500 karakter.').optional(),
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

  return NextResponse.json({ question: data, reviewSaved });
}
