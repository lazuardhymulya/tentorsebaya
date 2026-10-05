import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('access_codes')
    .select('id, code, usage_limit, usage_count, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data });
}

const schema = z.object({
  code: z.string().min(4, 'Kode minimal 4 karakter'),
  usageLimit: z.number().int().min(1),
});

function generateCode(): string {
  return 'TS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(request: Request) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse({
    code: body.code || generateCode(),
    usageLimit: Number(body.usageLimit) || 1,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('access_codes')
    .insert({
      code: parsed.data.code,
      usage_limit: parsed.data.usageLimit,
      created_by: 'admin',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codeRow: data });
}
