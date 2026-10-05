import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile, Role } from '@/lib/types';

export interface SessionProfile {
  authId: string;
  profile: Profile;
}

/**
 * Ambil user yang sedang login (dari cookie sesi Supabase Auth) sekaligus
 * baris profiles miliknya. Return null kalau belum login atau belum
 * menyelesaikan pendaftaran (profil belum dibuat).
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Pakai admin client di sini supaya tetap bisa baca profil sendiri
  // walau RLS profiles nanti diperketat lebih lanjut.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, username, full_name, avatar_url, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  return { authId: user.id, profile: profile as Profile };
}

/** Return null kalau belum login atau role-nya tidak sesuai — API route yang memanggil ini yang memutuskan response error-nya. */
export async function requireRole(role: Role): Promise<SessionProfile | null> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== role) return null;
  return session;
}
