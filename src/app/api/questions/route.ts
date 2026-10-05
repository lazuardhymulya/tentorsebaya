import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fillBroadcastSlots } from '@/lib/broadcast';

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'mentee') {
    return NextResponse.json({ error: 'Hanya mentee yang bisa mengajukan pertanyaan.' }, { status: 403 });
  }

  const formData = await request.formData();
  const subjectId = formData.get('subjectId');
  const content = formData.get('content');
  const photo = formData.get('photo') as File | null;

  if (typeof subjectId !== 'string' || typeof content !== 'string' || content.trim().length < 5) {
    return NextResponse.json({ error: 'Mapel dan isi pertanyaan wajib diisi.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Cegah mentee menumpuk banyak pertanyaan aktif sekaligus
  const { count: activeCount } = await admin
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('mentee_id', session.profile.id)
    .in('status', ['menunggu', 'berjalan']);

  if ((activeCount ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Kamu masih punya pertanyaan yang belum selesai. Selesaikan dulu sebelum bertanya lagi.' },
      { status: 409 }
    );
  }

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran foto maksimal 5MB.' }, { status: 400 });
    }
    const ext = photo.name.split('.').pop() || 'jpg';
    const path = `${session.profile.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from('question-photos')
      .upload(path, await photo.arrayBuffer(), { contentType: photo.type });
    if (uploadErr) {
      return NextResponse.json({ error: 'Gagal upload foto: ' + uploadErr.message }, { status: 500 });
    }
    photoUrl = admin.storage.from('question-photos').getPublicUrl(path).data.publicUrl;
  }

  const { data: question, error: insertErr } = await admin
    .from('questions')
    .insert({
      mentee_id: session.profile.id,
      subject_id: subjectId,
      content: content.trim(),
      photo_url: photoUrl,
    })
    .select()
    .single();

  if (insertErr || !question) {
    return NextResponse.json({ error: insertErr?.message ?? 'Gagal menyimpan pertanyaan.' }, { status: 500 });
  }

  const { assignedTentorIds } = await fillBroadcastSlots(admin, question);

  return NextResponse.json({ question, assignedTentorCount: assignedTentorIds.length });
}
