'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSessionProfile } from '@/lib/useSessionProfile';

interface PendingGift {
  id: string;
  rating: number;
  autoClosed: boolean;
  title: string | null;
  reviewText: string | null;
}

const CONFETTI_COLORS = ['#0ABE6B', '#F97316', '#FACC15', '#38BDF8', '#F472B6', '#A78BFA'];

/** Ledakan kertas warna-warni dari tengah kotak. Tanpa library; dilewati kalau pengguna meminta animasi dikurangi. */
function burstConfetti(container: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 110; i++) {
    const el = document.createElement('span');
    const size = 6 + Math.random() * 8;
    el.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:42%',
      `width:${size}px`,
      `height:${size * 0.45}px`,
      `background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`,
      'border-radius:2px',
      'pointer-events:none',
    ].join(';');
    container.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const speed = 160 + Math.random() * 340;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 220; // condong ke atas
    const spin = (Math.random() - 0.5) * 1080;
    const anim = el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px, ${dy + 460}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 1000, easing: 'cubic-bezier(.2,.7,.3,1)' }
    );
    anim.onfinish = () => el.remove();
  }
}

function useCountUp(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return value;
}

/**
 * Kado untuk tentor: begitu sesi berakhir (dan kadonya belum dibuka), muncul kotak kado.
 * Dibuka -> kertas warna-warni meledak -> tampil rating dan ulasan dari mentee.
 * Dipasang sekali di layout, jadi muncul di halaman mana pun tentor sedang berada.
 */
export function GiftHost() {
  const { profile } = useSessionProfile();
  const [gift, setGift] = useState<PendingGift | null>(null);
  const [opened, setOpened] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const showingRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const shownRating = useCountUp(gift?.rating ?? 0, revealed);

  const load = useCallback(async (tentorId: string) => {
    if (showingRef.current) return; // jangan menimpa kado yang sedang tampil
    const supabase = createClient();
    const { data, error } = await supabase
      .from('questions')
      .select('id, title, rating_given, auto_closed')
      .eq('accepted_tentor_id', tentorId)
      .eq('gift_pending', true)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return;

    const { data: review } = await supabase
      .from('tentor_reviews')
      .select('review_text')
      .eq('question_id', data.id)
      .maybeSingle();

    showingRef.current = true;
    setOpened(false);
    setRevealed(false);
    setGift({
      id: data.id as string,
      title: (data.title as string | null) ?? null,
      // Sesi yang ditutup otomatis dihitung 3.0 oleh sistem
      rating: Number(data.rating_given ?? 3.0),
      autoClosed: Boolean(data.auto_closed),
      reviewText: (review?.review_text as string | undefined) ?? null,
    });
  }, []);

  useEffect(() => {
    if (!profile || profile.role !== 'tentor') return;
    const supabase = createClient();
    load(profile.id);
    const channel = supabase
      .channel(`gift-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'questions', filter: `accepted_tentor_id=eq.${profile.id}` },
        () => load(profile.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, load]);

  function openGift() {
    setOpened(true);
    if (overlayRef.current) burstConfetti(overlayRef.current);
    setTimeout(() => setRevealed(true), 650);
  }

  async function closeGift() {
    const current = gift;
    setGift(null);
    showingRef.current = false;
    if (current) {
      await fetch('/api/gift/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: current.id }),
      }).catch(() => undefined);
      if (profile) load(profile.id); // kalau ada kado lain yang menunggu
    }
  }

  if (!gift) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/55 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kado dari sesi yang baru selesai"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        {!revealed && (
          <>
            <h2 className="text-xl font-semibold text-ink-900">
              {opened ? 'Selamat!' : 'Sesimu sudah selesai'}
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              {opened ? 'Ini hasil dari sesi tadi…' : 'Ada kado untukmu. Buka sekarang!'}
            </p>

            <svg viewBox="0 0 160 150" className={`mx-auto mt-4 h-40 w-40 ${opened ? '' : 'gift-wiggle'}`} aria-hidden="true">
              {/* badan kado */}
              <rect x="22" y="72" width="116" height="68" rx="8" fill="#0ABE6B" />
              <rect x="72" y="72" width="16" height="68" fill="#F97316" />
              {/* tutup kado */}
              <g
                style={{
                  transform: opened ? 'translateY(-64px) rotate(-22deg)' : 'none',
                  transformOrigin: '20px 74px',
                  transition: 'transform 600ms cubic-bezier(.3,1.5,.5,1)',
                }}
              >
                <rect x="14" y="50" width="132" height="26" rx="8" fill="#089955" />
                <rect x="72" y="50" width="16" height="26" fill="#F97316" />
                <ellipse cx="66" cy="44" rx="16" ry="10" fill="#F97316" />
                <ellipse cx="94" cy="44" rx="16" ry="10" fill="#F97316" />
                <circle cx="80" cy="47" r="7" fill="#EA580C" />
              </g>
            </svg>

            {!opened && (
              <button onClick={openGift} className="btn-primary mt-4 w-full">
                Buka kado
              </button>
            )}
          </>
        )}

        {revealed && (
          <div className="gift-reveal">
            <h2 className="text-xl font-semibold text-ink-900">Penilaian dari mentee</h2>
            {gift.title && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{gift.title}</p>}

            <div className="mt-4 flex items-center justify-center gap-2">
              <Star size={36} className="fill-accent-500 text-accent-500" />
              <span className="font-display text-5xl font-semibold text-ink-900">{shownRating.toFixed(1)}</span>
            </div>

            {gift.autoClosed ? (
              <p className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
                Sesi ini ditutup otomatis karena mentee tidak mengakhirinya, jadi dihitung 3.0.
              </p>
            ) : gift.reviewText ? (
              <blockquote className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-left text-sm text-ink-800">
                <p className="whitespace-pre-wrap">&ldquo;{gift.reviewText}&rdquo;</p>
              </blockquote>
            ) : (
              <p className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                Mentee tidak menulis ulasan kali ini.
              </p>
            )}

            <button onClick={closeGift} className="btn-primary mt-5 w-full">
              Terima kasih!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
