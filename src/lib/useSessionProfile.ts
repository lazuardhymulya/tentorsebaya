'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface UseSessionProfileResult {
  loading: boolean;
  profile: (Profile & { tentor?: { rating: number; is_available: boolean } }) | null;
}

export function useSessionProfile(): UseSessionProfileResult {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UseSessionProfileResult['profile']>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const { data: p } = await supabase
        .from('profiles')
        .select('id, role, username, full_name, avatar_url, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!p) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      let tentor: { rating: number; is_available: boolean } | undefined;
      if (p.role === 'tentor') {
        const { data: t } = await supabase
          .from('tentor_profiles')
          .select('rating, is_available')
          .eq('profile_id', p.id)
          .maybeSingle();
        if (t) tentor = { rating: Number(t.rating), is_available: t.is_available };
      }

      if (active) {
        setProfile({ ...(p as Profile), tentor });
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return { loading, profile };
}
