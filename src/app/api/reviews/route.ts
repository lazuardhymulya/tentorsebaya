import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('site_reviews')
    .select('id, content, created_at, profiles(username, role)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data });
}

const schema = z.object({ content: z.string().min(5).max(500) });

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: 'Login dulu untuk menulis ulasan.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ulasan minimal 5 karakter.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('site_reviews')
    .insert({ author_id: session.profile.id, content: parsed.data.content })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
