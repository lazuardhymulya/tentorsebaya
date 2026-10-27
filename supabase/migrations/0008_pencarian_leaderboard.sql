-- =========================================================================
-- Tahap 3 (Pilots): pencarian global (pertanyaan, tentor, mentee) dan
-- leaderboard tentor per mapel.
--
-- Pencarian memakai ekstensi pg_trgm (bawaan Supabase, gratis) untuk toleransi
-- salah ketik, ditambah pencocokan persis, awalan, potongan kata, dan full-text.
-- Semua fungsi HANYA bisa dipanggil lewat server (service role), tidak dari browser.
-- =========================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- 1. PENCARIAN PERTANYAAN (hanya postingan forum yang sedang tayang)
create or replace function public.search_posts(
  p_query text,
  p_subject uuid default null,
  p_limit int default 10,
  p_offset int default 0
)
returns table (post_id uuid, score real)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select trim(coalesce(p_query, '')) as t, lower(trim(coalesce(p_query, ''))) as lt
  ),
  base as (
    select sp.id as post_id,
           lower(coalesce(qu.title, '')) as title,
           lower(coalesce(qu.content, '') || ' ' || coalesce(sp.description, '')) as body,
           qu.tags as tags,
           lower(coalesce(sj.name, '')) as subject_name
    from public.session_posts sp
    join public.questions qu on qu.id = sp.question_id
    left join public.subjects sj on sj.id = qu.subject_id
    where sp.status = 'tayang'
      and (p_subject is null or qu.subject_id = p_subject)
  )
  select b.post_id,
         (
           case when b.title = q.lt then 3.0 else 0 end
           + case when left(b.title, length(q.lt)) = q.lt then 1.5 else 0 end
           + case when strpos(b.title, q.lt) > 0 then 1.0 else 0 end
           + case when exists (select 1 from unnest(b.tags) tg where lower(tg) = q.lt) then 1.2 else 0 end
           + case when exists (select 1 from unnest(b.tags) tg where strpos(lower(tg), q.lt) > 0) then 0.5 else 0 end
           + case when strpos(b.subject_name, q.lt) > 0 then 0.6 else 0 end
           + case when strpos(b.body, q.lt) > 0 then 0.6 else 0 end
           + case when to_tsvector('simple', b.title || ' ' || b.body) @@ plainto_tsquery('simple', q.t) then 0.5 else 0 end
           + greatest(word_similarity(q.lt, b.title), word_similarity(q.lt, b.subject_name))
         )::real as score
  from base b
  cross join q
  where q.t <> ''
    and (
      strpos(b.title, q.lt) > 0
      or strpos(b.body, q.lt) > 0
      or strpos(b.subject_name, q.lt) > 0
      or exists (select 1 from unnest(b.tags) tg where strpos(lower(tg), q.lt) > 0)
      or to_tsvector('simple', b.title || ' ' || b.body) @@ plainto_tsquery('simple', q.t)
      or word_similarity(q.lt, b.title) > 0.45
      or word_similarity(q.lt, b.subject_name) > 0.6
    )
  order by score desc, b.post_id
  limit p_limit offset p_offset
$$;

-- 2. PENCARIAN AKUN (tentor atau mentee)
--    Tentor selalu bisa dicari. Mentee hanya kalau privasinya "publik" atau "terbatas";
--    deskripsi mentee hanya ikut dicari kalau privasinya "publik".
--    Tanpa kata kunci, hanya untuk tentor (menelusuri berdasarkan filter), diurutkan dari rating.
create or replace function public.search_people(
  p_query text,
  p_role text,
  p_subject uuid default null,
  p_level text default null,
  p_limit int default 10,
  p_offset int default 0
)
returns table (profile_id uuid, score real)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select trim(coalesce(p_query, '')) as t, lower(trim(coalesce(p_query, ''))) as lt
  ),
  base as (
    select p.id,
           lower(p.username) as uname,
           p.role,
           p.privacy,
           lower(coalesce(p.bio, '')) as bio,
           tp.rating,
           tp.expertise_tags as tags,
           tp.taught_levels as levels,
           coalesce((
             select string_agg(lower(s.name), ' ')
             from public.tentor_subjects ts
             join public.subjects s on s.id = ts.subject_id
             where ts.tentor_id = p.id
           ), '') as subject_names
    from public.profiles p
    left join public.tentor_profiles tp on tp.profile_id = p.id
    where p.role = p_role
      and (p_role <> 'mentee' or p.privacy in ('publik', 'terbatas'))
      and (p_subject is null or exists (
            select 1 from public.tentor_subjects ts
            where ts.tentor_id = p.id and ts.subject_id = p_subject))
      and (p_level is null or p_level = any (coalesce(tp.taught_levels, '{}')))
  )
  select b.id as profile_id,
         (
           case when q.t = '' then coalesce(b.rating, 0) / 5.0
           else
             case when b.uname = q.lt then 3.0 else 0 end
             + case when left(b.uname, length(q.lt)) = q.lt then 1.5 else 0 end
             + case when strpos(b.uname, q.lt) > 0 then 1.0 else 0 end
             + case when b.role = 'tentor' and exists (select 1 from unnest(b.tags) tg where strpos(lower(tg), q.lt) > 0) then 1.0 else 0 end
             + case when b.role = 'tentor' and strpos(b.subject_names, q.lt) > 0 then 0.8 else 0 end
             + case when (b.role = 'tentor' or b.privacy = 'publik') and strpos(b.bio, q.lt) > 0 then 0.4 else 0 end
             + similarity(q.lt, b.uname)
           end
         )::real as score
  from base b
  cross join q
  where (q.t <> '' or p_role = 'tentor')
    and (
      q.t = ''
      or strpos(b.uname, q.lt) > 0
      or similarity(q.lt, b.uname) > 0.35
      or (b.role = 'tentor' and strpos(b.subject_names, q.lt) > 0)
      or (b.role = 'tentor' and exists (select 1 from unnest(b.tags) tg where strpos(lower(tg), q.lt) > 0))
      or ((b.role = 'tentor' or b.privacy = 'publik') and strpos(b.bio, q.lt) > 0)
    )
  order by score desc, b.uname
  limit p_limit offset p_offset
$$;

-- 3. LEADERBOARD PER MAPEL
--    Hanya dihitung dari sesi selesai di mapel itu (sesi yang ditutup otomatis dihitung 3.0).
--    Tingkat 1-10 dari rata-rata rating: 0.0-0.5 = 1, 0.6-1.0 = 2, ..., 4.6-5.0 = 10.
--    Urutan: tingkat tertinggi dulu, lalu jumlah jawaban terbanyak. Syarat masuk: minimal p_min_sessions sesi.
create or replace function public.leaderboard_by_subject(
  p_subject uuid,
  p_limit int default 20,
  p_min_sessions int default 3
)
returns table (tentor_id uuid, answered int, avg_rating numeric, tier int)
language sql
stable
as $$
  with agg as (
    select qu.accepted_tentor_id as tentor_id,
           count(*)::int as answered,
           round(avg(coalesce(qu.rating_given, 3.0))::numeric, 1) as avg_rating
    from public.questions qu
    where qu.status = 'selesai'
      and qu.subject_id = p_subject
      and qu.accepted_tentor_id is not null
    group by qu.accepted_tentor_id
    having count(*) >= p_min_sessions
  )
  select a.tentor_id,
         a.answered,
         a.avg_rating,
         least(10, greatest(1, ceil(a.avg_rating * 10 / 5)))::int as tier
  from agg a
  order by tier desc, a.answered desc, a.avg_rating desc, a.tentor_id
  limit p_limit
$$;

-- Hanya server (service role) yang boleh memanggil fungsi-fungsi ini
revoke execute on function public.search_posts(text, uuid, int, int) from public, anon, authenticated;
revoke execute on function public.search_people(text, text, uuid, text, int, int) from public, anon, authenticated;
revoke execute on function public.leaderboard_by_subject(uuid, int, int) from public, anon, authenticated;
grant execute on function public.search_posts(text, uuid, int, int) to service_role;
grant execute on function public.search_people(text, text, uuid, text, int, int) to service_role;
grant execute on function public.leaderboard_by_subject(uuid, int, int) to service_role;
