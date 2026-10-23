import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTags } from '@/lib/profile';

function unexpected(err: unknown) {
  return NextResponse.json(
    { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
    { status: 500 }
  );
}

/** Data profil milik sendiri, dipakai halaman Pengaturan Profil. */
export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: 'Login dulu.' }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, username, bio, photo_url, privacy')
      .eq('id', session.profile.id)
      .single();

    let tentor = null;
    if (session.profile.role === 'tentor') {
      const { data: t } = await admin
        .from('tentor_profiles')
        .select('achievements, expertise_tags, taught_levels')
        .eq('profile_id', session.profile.id)
        .single();
      const { data: subs } = await admin
        .from('tentor_subjects')
        .select('subject_id')
        .eq('tentor_id', session.profile.id);
      tentor = {
        achievements: t?.achievements ?? '',
        expertiseTags: (t?.expertise_tags as string[] | null) ?? [],
        taughtLevels: (t?.taught_levels as string[] | null) ?? [],
        subjectIds: (subs ?? []).map((s) => s.subject_id as string),
      };
    }

    return NextResponse.json({ profile, tentor });
  } catch (err) {
    return unexpected(err);
  }
}

const schema = z.object({
  bio: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter.').optional(),
  privacy: z.enum(['publik', 'terbatas', 'tidak_dapat_dicari']).optional(),
  achievements: z.string().trim().max(1000, 'Prestasi maksimal 1000 karakter.').optional(),
  expertiseTags: z.string().max(300).optional(),
  taughtLevels: z.array(z.enum(['X', 'XI', 'XII'])).optional(),
  subjectIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: 'Login dulu.' }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }, { status: 400 });
    }
    const input = parsed.data;
    const admin = createAdminClient();

    const profileUpdate: Record<string, unknown> = {};
    if (input.bio !== undefined) profileUpdate.bio = input.bio || null;
    // Pengaturan privasi hanya berlaku untuk mentee; profil tentor selalu terlihat
    if (input.privacy !== undefined && session.profile.role === 'mentee') {
      profileUpdate.privacy = input.privacy;
    }
    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await admin.from('profiles').update(profileUpdate).eq('id', session.profile.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (session.profile.role === 'tentor') {
      const tentorUpdate: Record<string, unknown> = {};
      if (input.achievements !== undefined) tentorUpdate.achievements = input.achievements || null;
      if (input.expertiseTags !== undefined) tentorUpdate.expertise_tags = parseTags(input.expertiseTags, 5);
      if (input.taughtLevels !== undefined) tentorUpdate.taught_levels = input.taughtLevels;
      if (Object.keys(tentorUpdate).length > 0) {
        const { error } = await admin
          .from('tentor_profiles')
          .update(tentorUpdate)
          .eq('profile_id', session.profile.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (input.subjectIds !== undefined) {
        if (input.subjectIds.length === 0) {
          return NextResponse.json({ error: 'Pilih minimal 1 mapel yang kamu kuasai.' }, { status: 400 });
        }
        // Tambah dulu yang baru, baru hapus yang tidak dipilih lagi (supaya tidak pernah kosong di tengah jalan)
        const { error: addErr } = await admin
          .from('tentor_subjects')
          .upsert(
            input.subjectIds.map((subject_id) => ({ tentor_id: session.profile.id, subject_id })),
            { onConflict: 'tentor_id,subject_id', ignoreDuplicates: true }
          );
        if (addErr) return NextResponse.json({ error: addErr.message }, { status: 500 });

        const { error: delErr } = await admin
          .from('tentor_subjects')
          .delete()
          .eq('tentor_id', session.profile.id)
          .not('subject_id', 'in', `(${input.subjectIds.join(',')})`);
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}
