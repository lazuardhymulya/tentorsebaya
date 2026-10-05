import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Dipakai di Server Component, Route Handler, atau Server Action.
 * Membaca sesi login user dari cookie sehingga query tetap tunduk pada RLS
 * (jadi aman dipakai untuk baca data, tapi jangan andalkan ini untuk aksi
 * sensitif — untuk itu pakai admin client di lib/supabase/admin.ts setelah
 * memverifikasi identitas user lewat client ini).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component (bukan Route Handler/Action) —
            // boleh diabaikan selama middleware.ts menangani refresh sesi.
          }
        },
      },
    }
  );
}
