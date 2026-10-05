import { createBrowserClient } from '@supabase/ssr';

/**
 * Dipakai di dalam Client Component ("use client"). Otomatis memakai
 * sesi login user yang tersimpan di cookie, dan tunduk pada RLS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
