import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Client dengan SERVICE ROLE KEY — melewati semua RLS.
 *
 * HANYA boleh dipakai di kode yang jalan di server (API route / cron),
 * dan HANYA setelah kode itu sendiri memverifikasi identitas & wewenang
 * pengguna (biasanya lewat lib/supabase/server.ts untuk membaca sesi login).
 * Jangan pernah import file ini dari Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
