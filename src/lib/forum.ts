import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostCardData } from './types';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FEED_PAGE_SIZE = 10;

interface PostCardRow {
  id: string;
  anonymous: boolean;
  published_at: string | null;
  question: { title: string | null; tags: string[] | null; subjects: { name: string } | null } | null;
  tentor: { username: string } | null;
  mentee: { username: string } | null;
}

const POST_CARD_SELECT =
  'id, anonymous, published_at, question:questions(title, tags, subjects(name)), tentor:profiles!tentor_id(username), mentee:profiles!mentee_id(username)';

function mapPostRow(r: PostCardRow): PostCardData {
  return {
    id: r.id,
    title: r.question?.title?.trim() || 'Tanpa judul',
    subject: r.question?.subjects?.name ?? null,
    tags: r.question?.tags ?? [],
    tentorUsername: r.tentor?.username ?? null,
    menteeUsername: r.anonymous ? null : r.mentee?.username ?? null,
    anonymous: r.anonymous,
    publishedAt: r.published_at,
  };
}

/** Postingan yang sudah tayang, terbaru dulu. Meminta limit+1 baris untuk tahu apakah masih ada halaman berikutnya. */
export async function loadPostCards(
  admin: SupabaseClient,
  opts: { tentorId?: string; menteeId?: string; excludeAnonymous?: boolean; offset: number; limit: number }
): Promise<{ cards: PostCardData[]; hasMore: boolean }> {
  let query = admin
    .from('session_posts')
    .select(POST_CARD_SELECT)
    .eq('status', 'tayang')
    .order('published_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit);

  if (opts.tentorId) query = query.eq('tentor_id', opts.tentorId);
  if (opts.menteeId) query = query.eq('mentee_id', opts.menteeId);
  if (opts.excludeAnonymous) query = query.eq('anonymous', false);

  const { data } = await query;
  const rows = ((data ?? []) as unknown as PostCardRow[]).map(mapPostRow);

  return { cards: rows.slice(0, opts.limit), hasMore: rows.length > opts.limit };
}

/** Kartu postingan sesuai urutan ID yang diberikan (dipakai hasil pencarian). Yang tidak lagi tayang dilewati. */
export async function loadPostCardsByIds(admin: SupabaseClient, ids: string[]): Promise<PostCardData[]> {
  if (ids.length === 0) return [];
  const { data } = await admin.from('session_posts').select(POST_CARD_SELECT).in('id', ids).eq('status', 'tayang');
  const byId = new Map(((data ?? []) as unknown as PostCardRow[]).map((r) => [r.id, mapPostRow(r)]));
  return ids.map((id) => byId.get(id)).filter((c): c is PostCardData => !!c);
}
