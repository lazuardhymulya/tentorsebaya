'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type TabKey = 'riwayat' | 'ulasan';

/**
 * Dua tab di profil tentor: "Riwayat sesi" dan "Ulasan".
 * Pengunjung hanya melihat satu isi pada satu waktu; pindah tab = isi bergeser
 * ke samping dengan transisi, dan tinggi kotak menyesuaikan isi yang tampil.
 */
export function ProfileTabs({
  history,
  reviews,
  reviewCount,
}: {
  history: ReactNode;
  reviews: ReactNode;
  reviewCount: number;
}) {
  const [active, setActive] = useState<TabKey>('riwayat');
  const [height, setHeight] = useState<number | undefined>(undefined);
  const historyRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = active === 'riwayat' ? historyRef.current : reviewsRef.current;
    if (!el) return;
    const update = () => setHeight(el.scrollHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);

  const tabClass = (key: TabKey) =>
    `flex-1 px-4 py-3 text-sm font-medium transition-colors ${
      active === key ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
    }`;

  const panelStyle = (key: TabKey) => ({
    visibility: (active === key ? 'visible' : 'hidden') as 'visible' | 'hidden',
    // sembunyikan panel yang tidak aktif SETELAH transisi geser selesai
    transition: active === key ? 'visibility 0s' : 'visibility 0s linear 300ms',
  });

  return (
    <section className="card mt-4 overflow-hidden p-0">
      <div role="tablist" className="relative flex border-b border-ink-100">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'riwayat'}
          onClick={() => setActive('riwayat')}
          className={tabClass('riwayat')}
        >
          Riwayat sesi
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'ulasan'}
          onClick={() => setActive('ulasan')}
          className={tabClass('ulasan')}
        >
          Ulasan{reviewCount > 0 ? ` (${reviewCount})` : ''}
        </button>
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 w-1/2 bg-brand-500 transition-transform duration-300 ease-out"
          style={{ transform: active === 'riwayat' ? 'translateX(0)' : 'translateX(100%)' }}
        />
      </div>

      <div className="overflow-hidden transition-[height] duration-300 ease-out" style={{ height }}>
        <div
          className="flex w-[200%] items-start transition-transform duration-300 ease-out"
          style={{ transform: active === 'riwayat' ? 'translateX(0)' : 'translateX(-50%)' }}
        >
          <div ref={historyRef} role="tabpanel" className="w-1/2 p-6" style={panelStyle('riwayat')}>
            {history}
          </div>
          <div ref={reviewsRef} role="tabpanel" className="w-1/2 p-6" style={panelStyle('ulasan')}>
            {reviews}
          </div>
        </div>
      </div>
    </section>
  );
}
