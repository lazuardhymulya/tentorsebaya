import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPostCardsByIds } from './forum';
import { ratingToDisplayTier } from './tier';
import type { PostCardData } from './types';

export const SEARCH_PAGE_SIZE = 10;

export interface PersonResult {
  id: string;
  username: string;
  role: 'tentor' | 'mentee';
  photoUrl: string | null;
  bio: string | null;
  tier: number | null;
  rating: number | null;
  ratingCount: number;
  subjects: string[];
  tags: string[];
}

export class SearchUnavailableError extends Error {}

function rpcError(message: string): never {
  // Fungsi database belum ada = migrasi 0008 belum dijalankan
  if (/function|schema cache|does not exist|permission denied/i.test(message)) {
    throw new SearchUnavailableError('Fitur pencarian belum aktif di database (migrasi 0008 belum dijalankan).');
  }
  throw new Error(message);
}

export async function searchPosts(
  admin: SupabaseClient,
  opts: { q: string; subjectId: string | null; offset: number; limit: number }
): Promise<{ cards: PostCardData[]; hasMore: boolean }> {
  const { data, error } = await admin.rpc('search_posts', {
    p_query: opts.q,
    p_subject: opts.subjectId,
    p_limit: opts.limit + 1,
    p_offset: opts.offset,
  });
  if (error) rpcError(error.message);
  const ids = ((data ?? []) as { post_id: string }[]).map((r) => r.post_id);
  const cards = await loadPostCardsByIds(admin, ids.slice(0, opts.limit));
  return { cards, hasMore: ids.length > opts.limit };
}

export async function searchPeople(
  admin: SupabaseClient,
  opts: { q: string; role: 'tentor' | 'mentee'; subjectId: string | null; level: string | null; offset: number; limit: number }
): Promise<{ people: PersonResult[]; hasMore: boolean }> {
  const { data, error } = await admin.rpc('search_people', {
    p_query: opts.q,
    p_role: opts.role,
    p_subject: opts.subjectId,
    p_level: opts.level,
    p_limit: opts.limit + 1,
    p_offset: opts.offset,
  });
  if (error) rpcError(error.message);
  const ids = ((data ?? []) as { profile_id: string }[]).map((r) => r.profile_id);
  const people = await loadPeopleByIds(admin, ids.slice(0, opts.limit));
  return { people, hasMore: ids.length > opts.limit };
}

/**
 * Data publik untuk kartu akun, sesuai urutan ID. Aturan privasi mentee diterapkan di sini:
 * foto hanya tampil kalau "publik"; deskripsi tampil untuk "publik" dan "terbatas".
 * Email, nomor telepon, dan lokasi memang tidak pernah diambil.
 */
export async function loadPeopleByIds(admin: SupabaseClient, ids: string[]): Promise<PersonResult[]> {
  if (ids.length === 0) return [];

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, role, bio, photo_url, privacy')
    .in('id', ids);
  const { data: tentors } = await admin
    .from('tentor_profiles')
    .select('profile_id, rating, rating_count, expertise_tags')
    .in('profile_id', ids);
  const { data: subs } = await admin
    .from('tentor_subjects')
    .select('tentor_id, subjects(name, sort_order)')
    .in('tentor_id', ids);

  const tentorMap = new Map(
    ((tentors ?? []) as { profile_id: string; rating: number; rating_count: number; expertise_tags: string[] | null }[]).map((t) => [t.profile_id, t])
  );
  const subjectMap = new Map<string, { name: string; sort_order: number }[]>();
  for (const row of (subs ?? []) as unknown as { tentor_id: string; subjects: { name: string; sort_order: number } | null }[]) {
    if (!row.subjects) continue;
    const list = subjectMap.get(row.tentor_id) ?? [];
    list.push(row.subjects);
    subjectMap.set(row.tentor_id, list);
  }

  const byId = new Map(
    ((profiles ?? []) as { id: string; username: string; role: 'tentor' | 'mentee'; bio: string | null; photo_url: string | null; privacy: string }[]).map(
      (p) => {
        const isTentor = p.role === 'tentor';
        const t = tentorMap.get(p.id);
        const showPhoto = isTentor || p.privacy === 'publik';
        const result: PersonResult = {
          id: p.id,
          username: p.username,
          role: p.role,
          photoUrl: showPhoto ? p.photo_url : null,
          bio: isTentor || p.privacy !== 'tidak_dapat_dicari' ? p.bio : null,
          tier: isTentor && t ? ratingToDisplayTier(Number(t.rating)) : null,
          rating: isTentor && t ? Number(t.rating) : null,
          ratingCount: isTentor && t ? t.rating_count : 0,
          subjects: (subjectMap.get(p.id) ?? []).sort((a, b) => a.sort_order - b.sort_order).map((s) => s.name),
          tags: isTentor && t ? t.expertise_tags ?? [] : [],
        };
        return [p.id, result] as const;
      }
    )
  );
  return ids.map((id) => byId.get(id)).filter((p): p is PersonResult => !!p);
}
