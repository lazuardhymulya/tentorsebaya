import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PostCard } from '@/components/PostCard';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { FEED_PAGE_SIZE, loadPostCards } from '@/lib/forum';

export const dynamic = 'force-dynamic';

export default async function BerandaPage({ searchParams }: { searchParams: { hal?: string } }) {
  const session = await getSessionProfile();
  if (!session) redirect('/masuk?redirect=/beranda');

  const page = Math.max(1, Number.parseInt(searchParams.hal ?? '1', 10) || 1);
  const admin = createAdminClient();
  const { cards, hasMore } = await loadPostCards(admin, {
    offset: (page - 1) * FEED_PAGE_SIZE,
    limit: FEED_PAGE_SIZE,
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Beranda</h1>
        <p className="mt-1 text-ink-600">
          Sesi belajar yang sudah selesai dan dipublikasikan atas persetujuan penanya dan tentornya. Buka salah satu untuk ikut berdiskusi.
        </p>

        <div className="mt-6 space-y-4">
          {cards.length === 0 ? (
            <div className="card text-center text-ink-500">
              {page > 1
                ? 'Tidak ada postingan di halaman ini.'
                : 'Belum ada sesi yang dipublikasikan. Postingan akan muncul di sini setelah ada sesi selesai yang disetujui untuk tayang.'}
            </div>
          ) : (
            cards.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>

        {(page > 1 || hasMore) && (
          <div className="mt-8 flex items-center justify-between">
            {page > 1 ? (
              <Link href={`/beranda?hal=${page - 1}`} className="btn-secondary">Sebelumnya</Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-ink-400">Halaman {page}</span>
            {hasMore ? (
              <Link href={`/beranda?hal=${page + 1}`} className="btn-secondary">Berikutnya</Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
