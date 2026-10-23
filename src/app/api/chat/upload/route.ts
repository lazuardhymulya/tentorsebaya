import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

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
  if (!session) {
    return NextResponse.json({ error: 'Login dulu.' }, { status: 401 });
  }

  const formData = await request.formData();
  const questionId = formData.get('questionId');
  const type = formData.get('type'); // 'foto' | 'suara'
  const file = formData.get('file') as File | null;

  if (typeof questionId !== 'string' || (type !== 'foto' && type !== 'suara') || !file) {
    return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
  }

  const maxSize = type === 'foto' ? 5 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'Ukuran file terlalu besar.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: question } = await admin
    .from('questions')
    .select('id, mentee_id, accepted_tentor_id, status')
    .eq('id', questionId)
    .maybeSingle();

  if (!question) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
  const isParticipant = question.mentee_id === session.profile.id || question.accepted_tentor_id === session.profile.id;
  if (!isParticipant) return NextResponse.json({ error: 'Kamu bukan peserta sesi ini.' }, { status: 403 });
  if (question.status !== 'berjalan') {
    return NextResponse.json({ error: 'Sesi ini sudah tidak aktif.' }, { status: 409 });
  }

  const ext = type === 'foto' ? file.name.split('.').pop() || 'jpg' : 'webm';
  const path = `${questionId}/${Date.now()}-${type}.${ext}`;
  const { error: uploadErr } = await admin.storage
    .from('chat-files')
    .upload(path, await file.arrayBuffer(), { contentType: file.type });

  if (uploadErr) {
    return NextResponse.json({ error: 'Gagal upload: ' + uploadErr.message }, { status: 500 });
  }

  const publicUrl = admin.storage.from('chat-files').getPublicUrl(path).data.publicUrl;

  const { data: message, error: insertErr } = await admin
    .from('messages')
    .insert({
      question_id: questionId,
      sender_id: session.profile.id,
      type,
      content: publicUrl,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ message });
}
