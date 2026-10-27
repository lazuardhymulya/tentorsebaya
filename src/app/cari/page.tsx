import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PostCard } from '@/components/PostCard';
import { PersonCard } from '@/components/PersonCard';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';
import { SEARCH_PAGE_SIZE, SearchUnavailableError, searchPeople, searchPosts, type PersonResult } from '@/lib/search';
import { TAUGHT_LEVELS } from '@/lib/profile';
import type { PostCardData } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Tab = 'pertanyaan' | 'tentor' | 'mentee';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pertanyaan', label: 'Pertanyaan' },
  { key: 'tentor', label: 'Tentor' },
  { key: 'mentee', label: 'Mentee' },
];

interface SearchParams {
  q?: string;
  tab?: string;
  mapel?: string;
  kelas?: string;
  hal?: string;
}

export default async function CariPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSessionProfile();
  if (!session) redirect('/masuk?redirect=/cari');

  const tab: Tab = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as Tab) : 'pertanyaan';
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const subjectId = searchParams.mapel && UUID_RE.test(searchParams.mapel) ? searchParams.mapel : null;
  const level = (TAUGHT_LEVELS as readonly string[]).includes(searchParams.kelas ?? '') ? (searchParams.kelas as string) : null;
  const page = Math.max(1, Number.parseInt(searchParams.hal ?? '1', 10) || 1);
  const offset = (page - 1) * SEARCH_PAGE_SIZE;

  const admin = createAdminClient();
  const { data: subjectRows } = await admin.from('subjects').select('id, name').order('sort_order');
  const subjects = (subjectRows ?? []) as { id: string; name: string }[];

  // Kata kunci wajib, kecuali di tab Tentor (kosong = menelusuri tentor lewat filter, urut rating)
  const shouldSearch = q !== '' || tab === 'tentor';
  let cards: PostCardData[] = [];
  let people: PersonResult[] = [];
  let hasMore = false;
  let problem: string | null = null;

  if (shouldSearch) {
    try {
      if (tab === 'pertanyaan') {
        const r = await searchPosts(admin, { q, subjectId, offset, limit: SEARCH_PAGE_SIZE });
        cards = r.cards;
        hasMore = r.hasMore;
      } else {
        const r = await searchPeople(admin, {
          q,
          role: tab,
          subjectId: tab === 'tentor' ? subjectId : null,
          level: tab === 'tentor' ? level : null,
          offset,
          limit: SEARCH_PAGE_SIZE,
        });
        people = r.people;
        hasMore = r.hasMore;
      }
    } catch (err) {
      problem =
        err instanceof SearchUnavailableError ? err.message : 'Pencarian sedang bermasalah. Coba lagi sebentar lagi.';
    }
  }

  const href = (over: Partial<SearchParams>) => {
    const next: Record<string, string> = { tab, ...(q ? { q } : {}) };
    if (subjectId && tab !== 'mentee') next.mapel = subjectId;
    if (level && tab === 'tentor') next.kelas = level;
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === '') delete next[k];
      else next[k] = v;
    }
    return `/cari?${new URLSearchParams(next).toString()}`;
  };

  const resultsCount = tab === 'pertanyaan' ? cards.length : people.length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Cari</h1>

        <form action="/cari" method="get" className="mt-4 space-y-3">
          <input type="hidden" name="tab" value={tab} />
          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              maxLength={80}
              className="input-field"
              placeholder={
                tab === 'pertanyaan' ? 'Cari pertanyaan, mis. metabolisme' : tab === 'tentor' ? 'Cari tentor atau mapel' : 'Cari username mentee'
              }
              autoFocus={!q}
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              <Search size={16} /> Cari
            </button>
          </div>

          {tab !== 'mentee' && (
            <div className="flex flex-wrap gap-2">
              <select name="mapel" defaultValue={subjectId ?? ''} className="input-field w-auto py-2 text-sm">
                <option value="">Semua mapel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {tab === 'tentor' && (
                <select name="kelas" defaultValue={level ?? ''} className="input-field w-auto py-2 text-sm">
                  <option value="">Semua kelas yang diajar</option>
                  {TAUGHT_LEVELS.map((l) => (
                    <option key={l} value={l}>Kelas {l}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </form>

        <nav className="mt-5 flex gap-1 border-b border-ink-100" aria-label="Kategori pencarian">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ tab: t.key, hal: undefined })}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                t.key === tab ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 space-y-4">
          {problem && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{problem}</p>}

          {!problem && !shouldSearch && (
            <div className="card text-center text-ink-500">Ketik kata kunci di atas untuk mulai mencari.</div>
          )}

          {!problem && shouldSearch && resultsCount === 0 && (
            <div className="card text-center text-ink-500">
              {q
                ? `Tidak ada hasil untuk “${q}”. Coba kata lain atau periksa ejaannya.`
                : 'Belum ada tentor yang cocok dengan filter ini.'}
              {tab === 'pertanyaan' && ' Pertanyaan hanya muncul dari sesi yang sudah dipublikasikan.'}
            </div>
          )}

          {tab === 'pertanyaan' && cards.map((post) => <PostCard key={post.id} post={post} />)}
          {tab !== 'pertanyaan' && people.map((person) => <PersonCard key={person.id} person={person} />)}
        </div>

        {(page > 1 || hasMore) && (
          <div className="mt-8 flex items-center justify-between">
            {page > 1 ? <Link href={href({ hal: String(page - 1) })} className="btn-secondary">Sebelumnya</Link> : <span />}
            <span className="text-sm text-ink-400">Halaman {page}</span>
            {hasMore ? <Link href={href({ hal: String(page + 1) })} className="btn-secondary">Berikutnya</Link> : <span />}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
