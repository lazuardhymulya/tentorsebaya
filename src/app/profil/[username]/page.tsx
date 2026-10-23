import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Star } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Avatar } from '@/components/Avatar';
import { UserLink } from '@/components/UserLink';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ratingToDisplayTier } from '@/lib/tier';

export const dynamic = 'force-dynamic';

interface ReviewRow {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
  mentee: { username: string } | null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function ProfilPage({ params }: { params: { username: string } }) {
  const username = safeDecode(params.username);

  const session = await getSessionProfile();
  if (!session) redirect(`/masuk?redirect=${encodeURIComponent(`/profil/${username}`)}`);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, username, bio, photo_url, privacy, created_at')
    .eq('username', username)
    .maybeSingle();

  if (!profile) notFound();

  const isSelf = session.profile.id === profile.id;
  const isTentor = profile.role === 'tentor';
  // Profil tentor selalu terlihat penuh. Mentee mengikuti pengaturan privasinya sendiri.
  const fullView = isTentor || isSelf || profile.privacy === 'publik';

  let tentor: {
    rating: number;
    rating_count: number;
    achievements: string | null;
    expertise_tags: string[];
    taught_levels: string[];
  } | null = null;
  let subjectNames: string[] = [];
  let reviews: ReviewRow[] = [];

  if (isTentor) {
    const { data: t } = await admin
      .from('tentor_profiles')
      .select('rating, rating_count, achievements, expertise_tags, taught_levels')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (t) {
      tentor = {
        rating: Number(t.rating),
        rating_count: t.rating_count as number,
        achievements: t.achievements as string | null,
        expertise_tags: (t.expertise_tags as string[] | null) ?? [],
        taught_levels: (t.taught_levels as string[] | null) ?? [],
      };
    }

    const { data: subs } = await admin
      .from('tentor_subjects')
      .select('subjects(name, sort_order)')
      .eq('tentor_id', profile.id);
    subjectNames = ((subs ?? []) as unknown as { subjects: { name: string; sort_order: number } | null }[])
      .map((row) => row.subjects)
      .filter((s): s is { name: string; sort_order: number } => !!s)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => s.name);

    const { data: reviewRows } = await admin
      .from('tentor_reviews')
      .select('id, rating, review_text, created_at, mentee:profiles!mentee_id(username)')
      .eq('tentor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    reviews = (reviewRows ?? []) as unknown as ReviewRow[];
  }

  const joined = new Date(profile.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const showPhoto = fullView;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Kepala profil */}
        <section className="card flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar username={profile.username} photoUrl={showPhoto ? profile.photo_url : null} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold text-ink-900">@{profile.username}</h1>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isTentor ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600'
                }`}
              >
                {isTentor ? 'Tentor' : 'Mentee'}
              </span>
              {isTentor && tentor && (
                <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">
                  Tingkat {ratingToDisplayTier(tentor.rating)} dari 10
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-500">Bergabung sejak {joined}</p>
          </div>
          {isSelf && (
            <Link href="/pengaturan/profil" className="btn-secondary self-start sm:self-center">
              <Pencil size={16} /> Edit profil
            </Link>
          )}
        </section>

        {/* Statistik tentor */}
        {isTentor && tentor && (
          <section className="mt-4 grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="flex items-center justify-center gap-1 font-display text-2xl font-semibold text-ink-900">
                <Star size={18} className="fill-accent-500 text-accent-500" />
                {tentor.rating.toFixed(1)}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {tentor.rating_count === 0 ? 'Belum ada penilaian' : 'Rating'}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="font-display text-2xl font-semibold text-ink-900">{tentor.rating_count}</p>
              <p className="mt-1 text-xs text-ink-500">Jawaban dinilai</p>
            </div>
            <div className="card p-4 text-center">
              <p className="font-display text-2xl font-semibold text-ink-900">{ratingToDisplayTier(tentor.rating)}</p>
              <p className="mt-1 text-xs text-ink-500">Tingkat (1 sampai 10)</p>
            </div>
          </section>
        )}

        {/* Mentee dengan profil dibatasi */}
        {!fullView && (
          <section className="card mt-4">
            <h2 className="text-lg font-semibold text-ink-900">Tentang</h2>
            <p className="mt-2 whitespace-pre-wrap text-ink-700">
              {profile.bio || <span className="text-ink-400">Belum ada deskripsi.</span>}
            </p>
            <p className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
              Pemilik akun ini membatasi profilnya, jadi hanya deskripsi singkat yang tampil.
            </p>
          </section>
        )}

        {fullView && (
          <>
            {/* Tentang */}
            <section className="card mt-4">
              <h2 className="text-lg font-semibold text-ink-900">Tentang</h2>
              <p className="mt-2 whitespace-pre-wrap text-ink-700">
                {profile.bio || (
                  <span className="text-ink-400">
                    {isSelf ? 'Kamu belum menulis deskripsi. Tambahkan lewat Edit profil.' : 'Belum ada deskripsi.'}
                  </span>
                )}
              </p>
            </section>

            {/* Khusus tentor: bidang, kelas, prestasi */}
            {isTentor && tentor && (
              <>
                <section className="card mt-4">
                  <h2 className="text-lg font-semibold text-ink-900">Bidang keahlian</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {subjectNames.map((name) => (
                      <span key={name} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                        {name}
                      </span>
                    ))}
                    {tentor.expertise_tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-ink-200 px-3 py-1 text-sm text-ink-600">
                        {tag}
                      </span>
                    ))}
                    {subjectNames.length === 0 && tentor.expertise_tags.length === 0 && (
                      <span className="text-ink-400">Belum diisi.</span>
                    )}
                  </div>
                  <h3 className="mt-5 text-sm font-medium text-ink-700">Kelas yang diajar</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tentor.taught_levels.length > 0 ? (
                      tentor.taught_levels.map((level) => (
                        <span key={level} className="rounded-full bg-ink-100 px-3 py-1 text-sm text-ink-700">
                          Kelas {level}
                        </span>
                      ))
                    ) : (
                      <span className="text-ink-400">Belum diisi.</span>
                    )}
                  </div>
                </section>

                <section className="card mt-4">
                  <h2 className="text-lg font-semibold text-ink-900">Prestasi</h2>
                  <p className="mt-2 whitespace-pre-wrap text-ink-700">
                    {tentor.achievements || <span className="text-ink-400">Belum diisi.</span>}
                  </p>
                </section>
              </>
            )}

            {/* Riwayat sesi yang dipublikasikan: diisi pada Tahap 2 */}
            <section className="card mt-4">
              <h2 className="text-lg font-semibold text-ink-900">
                {isTentor ? 'Riwayat jawaban' : 'Riwayat pertanyaan'}
              </h2>
              <p className="mt-2 text-ink-400">Belum ada sesi yang dipublikasikan.</p>
            </section>

            {/* Ulasan untuk tentor */}
            {isTentor && (
              <section className="card mt-4">
                <h2 className="text-lg font-semibold text-ink-900">Ulasan dari mentee</h2>
                {reviews.length === 0 ? (
                  <p className="mt-2 text-ink-400">Belum ada ulasan.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-ink-100">
                    {reviews.map((r) => (
                      <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3">
                          {r.mentee ? <UserLink username={r.mentee.username} /> : <span className="text-ink-500">Pengguna</span>}
                          <span className="flex items-center gap-1 text-sm font-medium text-accent-600">
                            <Star size={14} className="fill-accent-500 text-accent-500" />
                            {Number(r.rating).toFixed(1)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-ink-700">{r.review_text}</p>
                        <p className="mt-1 text-xs text-ink-400">
                          {new Date(r.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
