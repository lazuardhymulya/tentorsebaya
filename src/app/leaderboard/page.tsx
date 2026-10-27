import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Star, Trophy } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Avatar } from '@/components/Avatar';
import { UserLink } from '@/components/UserLink';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/forum';

export const dynamic = 'force-dynamic';

const LIMIT = 20;
const MIN_SESSIONS = 3;

interface BoardRow {
  tentor_id: string;
  answered: number;
  avg_rating: number | string;
  tier: number;
}

const RANK_STYLE = [
  'bg-accent-300 text-ink-900',
  'bg-ink-200 text-ink-800',
  'bg-accent-100 text-accent-700',
];

export default async function LeaderboardPage({ searchParams }: { searchParams: { mapel?: string } }) {
  const session = await getSessionProfile();
  if (!session) redirect('/masuk?redirect=/leaderboard');

  const admin = createAdminClient();
  const { data: subjectRows } = await admin.from('subjects').select('id, name').order('sort_order');
  const subjects = (subjectRows ?? []) as { id: string; name: string }[];

  const requested = searchParams.mapel && UUID_RE.test(searchParams.mapel) ? searchParams.mapel : null;
  const selected = subjects.find((s) => s.id === requested) ?? subjects[0] ?? null;

  let rows: BoardRow[] = [];
  let problem: string | null = null;
  if (selected) {
    const { data, error } = await admin.rpc('leaderboard_by_subject', {
      p_subject: selected.id,
      p_limit: LIMIT,
      p_min_sessions: MIN_SESSIONS,
    });
    if (error) {
      problem = /function|schema cache|does not exist|permission denied/i.test(error.message)
        ? 'Leaderboard belum aktif di database (migrasi 0008 belum dijalankan).'
        : 'Leaderboard sedang bermasalah. Coba lagi sebentar lagi.';
    } else {
      rows = (data ?? []) as BoardRow[];
    }
  }

  const ids = rows.map((r) => r.tentor_id);
  const { data: profileRows } = ids.length
    ? await admin.from('profiles').select('id, username, photo_url').in('id', ids)
    : { data: [] };
  const profiles = new Map(
    ((profileRows ?? []) as { id: string; username: string; photo_url: string | null }[]).map((p) => [p.id, p])
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-accent-600" />
          <h1 className="text-2xl font-semibold text-ink-900">Leaderboard tentor</h1>
        </div>
        <p className="mt-1 text-ink-600">Peringkat tentor di tiap mata pelajaran. Pilih mapelnya di bawah.</p>

        <nav className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Pilih mapel">
          {subjects.map((s) => (
            <Link
              key={s.id}
              href={`/leaderboard?mapel=${s.id}`}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                s.id === selected?.id
                  ? 'border-brand-500 bg-brand-500 font-medium text-white'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300'
              }`}
            >
              {s.name}
            </Link>
          ))}
        </nav>

        <div className="mt-6 space-y-3">
          {problem && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{problem}</p>}

          {!problem && rows.length === 0 && (
            <div className="card text-center text-ink-500">
              Belum ada tentor yang memenuhi syarat di {selected?.name ?? 'mapel ini'}. Tentor masuk daftar setelah menyelesaikan minimal {MIN_SESSIONS} sesi di mapel ini.
            </div>
          )}

          {rows.map((row, index) => {
            const profile = profiles.get(row.tentor_id);
            if (!profile) return null;
            const own = row.tentor_id === session.profile.id;
            return (
              <div
                key={row.tentor_id}
                className={`card flex items-center gap-4 p-4 ${own ? 'border-brand-300 bg-brand-50/40' : ''}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold ${
                    RANK_STYLE[index] ?? 'bg-ink-100 text-ink-600'
                  }`}
                  aria-label={`Peringkat ${index + 1}`}
                >
                  {index + 1}
                </span>
                <Avatar username={profile.username} photoUrl={profile.photo_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <UserLink username={profile.username} className="text-base" />
                    {own && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">Kamu</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">{row.answered} jawaban dinilai di mapel ini</p>
                </div>
                <div className="text-right">
                  <p className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">Tingkat {row.tier}</p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-sm font-medium text-ink-700">
                    <Star size={13} className="fill-accent-500 text-accent-500" />
                    {Number(row.avg_rating).toFixed(1)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 rounded-2xl bg-ink-50 px-4 py-3 text-xs text-ink-500">
          Peringkat dihitung hanya dari sesi di mapel yang dipilih. Urutannya: tingkat tertinggi dulu (dari rating rata-rata, tingkat 1 sampai 10), lalu jumlah jawaban terbanyak. Menampilkan {LIMIT} teratas, dan tentor perlu minimal {MIN_SESSIONS} sesi selesai di mapel itu.
        </p>
      </main>
      <Footer />
    </>
  );
}
