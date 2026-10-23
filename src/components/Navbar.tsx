'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, GraduationCap, LogOut, Menu, Search, X } from 'lucide-react';
import { useSessionProfile } from '@/lib/useSessionProfile';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { APP_NAME } from '@/lib/brand';
import { Avatar } from '@/components/Avatar';
import { profileHref } from '@/components/UserLink';

export function Navbar() {
  const { profile, loading } = useSessionProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [available, setAvailable] = useState(profile?.tentor?.is_available ?? false);
  const router = useRouter();

  useEffect(() => {
    setAvailable(profile?.tentor?.is_available ?? false);
  }, [profile?.tentor?.is_available]);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();

    async function loadCount() {
      if (!profile) return;
      if (profile.role === 'tentor') {
        const { count } = await supabase
          .from('question_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('tentor_id', profile.id)
          .eq('status', 'menunggu');
        setNotifCount(count ?? 0);
      } else {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('mentee_id', profile.id)
          .in('status', ['menunggu', 'berjalan']);
        setNotifCount(count ?? 0);
      }
    }

    loadCount();
    const channel = supabase
      .channel('navbar-notif')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: profile.role === 'tentor' ? 'question_assignments' : 'questions' },
        () => loadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  async function toggleAvailability() {
    const next = !available;
    setAvailable(next);
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isAvailable: next }),
    });
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  const homeHref = profile ? '/dashboard' : '/';
  // Ala Brainly: search/ask-bar di navbar ADALAH cara mengajukan pertanyaan.
  // Belum login -> diarahkan daftar dulu (sesuai alur yang diminta). Tentor
  // tidak bertanya, jadi bar ini disembunyikan untuk role tentor.
  const askHref = !profile ? '/daftar/mentee' : profile.role === 'mentee' ? '/pertanyaan/ajukan' : null;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href={homeHref} className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
            <GraduationCap size={20} />
          </span>
          <span className="hidden font-display text-lg font-semibold tracking-tight text-ink-900 sm:inline">
            {APP_NAME}
          </span>
        </Link>

        {askHref && (
          <button
            onClick={() => router.push(askHref)}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-full border border-ink-200 bg-ink-50 px-4 py-2.5 text-left text-sm text-ink-500 transition hover:border-brand-300 hover:bg-white"
          >
            <Search size={16} className="shrink-0 text-ink-400 group-hover:text-brand-500" />
            <span className="truncate">Tanya apa aja soal pelajaran, gratis…</span>
          </button>
        )}

        {!askHref && !loading && !profile && (
          <nav className="hidden flex-1 items-center gap-6 text-sm font-medium text-ink-600 md:flex">
            <a href="#cara-kerja" className="hover:text-ink-900">Cara kerja</a>
            <a href="#ulasan" className="hover:text-ink-900">Ulasan</a>
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {!loading && !profile && (
            <>
              <Link href="/masuk" className="btn-ghost hidden sm:inline-flex">Masuk</Link>
              <Link href="/daftar" className="btn-primary">Daftar</Link>
            </>
          )}

          {!loading && profile && profile.role === 'tentor' && (
            <button
              onClick={toggleAvailability}
              className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition sm:flex ${
                available
                  ? 'border-online-500/30 bg-online-500/10 text-online-600'
                  : 'border-ink-200 bg-white text-ink-500'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${available ? 'bg-online-500' : 'bg-ink-300'}`} />
              {available ? 'Tersedia' : 'Tidak tersedia'}
            </button>
          )}

          {!loading && profile && profile.role === 'mentee' && (
            <Link href="/pertanyaan/ajukan" className="btn-primary hidden sm:inline-flex">
              Ajukan Pertanyaan
            </Link>
          )}

          {!loading && profile && (
            <Link href="/notifikasi" className="relative rounded-full p-2 hover:bg-ink-100">
              <Bell size={20} className="text-ink-600" />
              {notifCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
                  {notifCount}
                </span>
              )}
            </Link>
          )}

          {!loading && profile && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-2 hover:bg-ink-100 md:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}

          {!loading && profile && (
            <div className="hidden items-center gap-3 pl-1 md:flex">
              <Link
                href={profileHref(profile.username)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-ink-100"
              >
                <Avatar username={profile.username} photoUrl={profile.photo_url} size="sm" />
                <span className="text-left text-sm leading-tight">
                  <span className="block font-medium text-ink-900">{profile.username}</span>
                  {profile.tentor && (
                    <span className="block text-xs text-ink-400">★ {profile.tentor.rating.toFixed(1)}</span>
                  )}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Keluar"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {menuOpen && profile && (
        <div className="border-t border-ink-100 bg-white px-4 py-3 md:hidden">
          <Link
            href={profileHref(profile.username)}
            onClick={() => setMenuOpen(false)}
            className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-900"
          >
            <Avatar username={profile.username} photoUrl={profile.photo_url} size="sm" />
            {profile.username}
          </Link>
          {profile.role === 'mentee' && (
            <Link href="/pertanyaan/ajukan" className="btn-primary mb-2 w-full">
              Ajukan Pertanyaan
            </Link>
          )}
          {profile.role === 'tentor' && (
            <button onClick={toggleAvailability} className="btn-secondary mb-2 w-full">
              {available ? 'Tersedia — matikan' : 'Tidak tersedia — nyalakan'}
            </button>
          )}
          <button onClick={handleLogout} className="btn-ghost w-full justify-start">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      )}
    </header>
  );
}
