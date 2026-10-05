import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Supabase mengarahkan browser ke sini setelah user selesai login lewat
 * Google. Kita tukar "code" dengan sesi, lalu cek apakah profil sudah ada
 * untuk menentukan tujuan redirect berikutnya.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const role = searchParams.get('role'); // 'tentor' | 'mentee', dikirim dari halaman /daftar/*

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile) {
        // Sudah pernah daftar -> tetap wajib konfirmasi username+password (bukan langsung masuk)
        return NextResponse.redirect(`${origin}/masuk?step=konfirmasi`);
      }

      if (!role) {
        // Klik "Masuk" tapi belum pernah daftar sama sekali
        return NextResponse.redirect(`${origin}/daftar?belum-terdaftar=1`);
      }

      // Belum punya profil & tahu mau daftar sebagai apa -> lanjut ke form pendaftaran
      const target = role === 'tentor' ? '/daftar/tentor' : '/daftar/mentee';
      return NextResponse.redirect(`${origin}${target}?step=lengkapi`);
    }
  }

  return NextResponse.redirect(`${origin}/masuk?error=gagal-login`);
}
