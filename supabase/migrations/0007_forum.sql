-- =========================================================================
-- Tahap 2 (Pilots): publikasi sesi ke forum diskusi.
--
-- Alur: mentee setuju sesi dipublikasikan (saat mengakhiri sesi) ->
-- tentor memilih pesan chat yang ditampilkan + menulis penjelasan tambahan ->
-- tayang di forum -> orang lain berdiskusi lewat komentar.
--
-- Jalankan SEBELUM kode baru di-deploy.
-- =========================================================================

-- 1. POSTINGAN FORUM (satu per sesi)
create table if not exists public.session_posts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions (id) on delete cascade,
  mentee_id uuid not null references public.profiles (id) on delete cascade,
  tentor_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'menunggu_tentor'
    check (status in ('menunggu_tentor', 'tayang', 'ditarik', 'kedaluwarsa')),
  anonymous boolean not null default false,
  selected_message_ids uuid[] not null default '{}',
  description text,
  description_photos text[] not null default '{}',
  show_question_photo boolean not null default true,
  mentee_seen boolean not null default false,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  published_at timestamptz,
  withdrawn_at timestamptz
);

create index if not exists session_posts_feed_idx on public.session_posts (status, published_at desc);
create index if not exists session_posts_tentor_idx on public.session_posts (tentor_id, status);
create index if not exists session_posts_mentee_idx on public.session_posts (mentee_id, status);

-- 2. KOMENTAR FORUM
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.session_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.post_comments (id) on delete cascade,
  content text not null,
  is_correction boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- 3. SUKA PADA KOMENTAR
create table if not exists public.comment_likes (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- 4. LAPORAN KONTEN
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reason text,
  status text not null default 'baru' check (status in ('baru', 'selesai')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- RLS: semua tabel dikunci. Hanya session_posts yang boleh DIBACA peserta sesinya
-- (supaya notifikasi realtime di browser jalan). Selebihnya hanya lewat server.
alter table public.session_posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.content_reports enable row level security;

drop policy if exists "session_posts_select_participant" on public.session_posts;
create policy "session_posts_select_participant" on public.session_posts
  for select using (auth.uid() = mentee_id or auth.uid() = tentor_id);

-- GRANT eksplisit (wajib sejak perubahan default Supabase)
grant select on public.session_posts to authenticated;
grant select, insert, update, delete on public.session_posts to service_role;
grant select, insert, update, delete on public.post_comments to service_role;
grant select, insert, update, delete on public.comment_likes to service_role;
grant select, insert, update, delete on public.content_reports to service_role;

-- Realtime untuk notifikasi (tawaran menyusun postingan, postingan tayang)
alter publication supabase_realtime add table public.session_posts;

-- 5. BUCKET FOTO PENJELASAN TAMBAHAN (publik-baca; upload hanya lewat server)
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;
