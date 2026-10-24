'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';

/**
 * Foto lebar di bawah footer.
 *
 * Cara pasang: taruh file foto bernama persis  foto-footer.jpg  di folder
 * "public" project ini. Kalau filenya belum ada, bagian ini otomatis tidak tampil.
 *
 * Responsif: tinggi foto menyesuaikan layar, dan fotonya DIPOTONG (bukan
 * dilebarkan/gepeng). Titik yang dijaga tetap terlihat diatur lewat
 * FOOTER_PHOTO_FOCUS di bawah: "geser-horizontal geser-vertikal" dalam persen.
 *   '50% 50%' = tengah (bawaan)     '50% 20%' = bagian atas foto
 *   '25% 50%' = agak ke kiri        '75% 50%' = agak ke kanan
 */
export const FOOTER_PHOTO_FOCUS = '50% 50%';
const FOOTER_PHOTO_SRC = '/foto-footer.jpg';

export function FooterPhoto() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  // Gambar yang sudah ter-cache bisa selesai dimuat sebelum React aktif
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) setStatus(img.naturalWidth > 0 ? 'ok' : 'error');
  }, []);

  if (status === 'error') return null;

  return (
    <div
      // absolute + top-full: foto menempel tepat di bawah dasar halaman, di luar tinggi layar,
      // jadi baru terlihat kalau pengunjung menggeser ke bawah (footer tetap mentok di dasar layar)
      className={status === 'ok' ? 'absolute inset-x-0 top-full overflow-hidden bg-ink-100' : 'hidden'}
    >
      <img
        ref={imgRef}
        src={FOOTER_PHOTO_SRC}
        alt="Foto kegiatan"
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        className="h-48 w-full object-cover sm:h-64 lg:h-80"
        style={{ objectPosition: FOOTER_PHOTO_FOCUS }}
      />
    </div>
  );
}
