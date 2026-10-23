-- =========================================================================
-- Tahap 1 (Pilots): profil publik, privasi mentee, ulasan teks untuk tentor,
-- judul & topik pertanyaan, dan bucket foto profil.
--
-- AMAN dijalankan SEBELUM kode baru di-deploy: kolom baru semuanya boleh
-- kosong, jadi kode lama tetap jalan normal sambil menunggu deploy.
-- =========================================================================

-- 1. PROFIL: deskripsi, foto profil, pengaturan privasi (dipakai untuk mentee)
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists privacy text not null default 'terbatas';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_privacy_check'
  ) then
    alter table public.profiles
      add constraint profiles_privacy_check
      check (privacy in ('publik', 'terbatas', 'tidak_dapat_dicari'));
  end if;
end $$;

-- 2. PROFIL TENTOR: prestasi (teks), tag keahlian, kelas yang diajar
alter table public.tentor_profiles add column if not exists achievements text;
alter table public.tentor_profiles add column if not exists expertise_tags text[] not null default '{}';
alter table public.tentor_profiles add column if not exists taught_levels text[] not null default '{}';

-- 3. PERTANYAAN: judul & topik/tag
alter table public.questions add column if not exists title text;
alter table public.questions add column if not exists tags text[] not null default '{}';

-- 4. ULASAN TEKS UNTUK TENTOR (tampil publik di profil tentor)
create table if not exists public.tentor_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions (id) on delete cascade,
  tentor_id uuid not null references public.profiles (id) on delete cascade,
  mentee_id uuid not null references public.profiles (id) on delete cascade,
  rating numeric(2, 1) not null,
  review_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists tentor_reviews_tentor_idx on public.tentor_reviews (tentor_id, created_at desc);

alter table public.tentor_reviews enable row level security;

drop policy if exists "tentor_reviews_select_authenticated" on public.tentor_reviews;
create policy "tentor_reviews_select_authenticated" on public.tentor_reviews
  for select using (auth.role() = 'authenticated');

-- GRANT eksplisit (wajib sejak perubahan default Supabase untuk project baru)
grant select on public.tentor_reviews to authenticated;
grant select, insert, update, delete on public.tentor_reviews to service_role;

-- 5. BUCKET FOTO PROFIL (publik-baca; upload hanya lewat server)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
