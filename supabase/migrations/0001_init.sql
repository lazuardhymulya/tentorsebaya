-- =========================================================================
-- TentorSebaya — skema database awal
-- Jalankan file ini di Supabase Dashboard > SQL Editor (atau lewat Supabase CLI)
-- =========================================================================

create extension if not exists "pgcrypto"; -- untuk gen_random_uuid()

-- -------------------------------------------------------------------------
-- 1. PROFILES — satu baris per akun (Tentor maupun Mentee), 1:1 dengan auth.users
-- -------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('tentor', 'mentee')),
  username text not null unique,
  password_hash text not null, -- credential tambahan di luar sesi Google, JANGAN pernah di-select dari client
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on column public.profiles.password_hash is
  'Hash bcrypt. Hanya boleh dibaca/ditulis lewat server (service role). Jangan select kolom ini dari browser.';

-- -------------------------------------------------------------------------
-- 2. SUBJECTS — daftar mata pelajaran
-- -------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  group_name text not null check (group_name in ('IPA', 'IPS', 'Wajib')),
  sort_order int not null default 0
);

insert into public.subjects (name, group_name, sort_order) values
  ('Matematika', 'IPA', 1),
  ('Fisika', 'IPA', 2),
  ('Kimia', 'IPA', 3),
  ('Biologi', 'IPA', 4),
  ('Ekonomi', 'IPS', 5),
  ('Sejarah', 'IPS', 6),
  ('Geografi', 'IPS', 7),
  ('Sosiologi', 'IPS', 8),
  ('Bahasa Indonesia', 'Wajib', 9),
  ('Bahasa Inggris', 'Wajib', 10),
  ('Bahasa Jerman', 'Wajib', 11),
  ('PPKn', 'Wajib', 12),
  ('Pendidikan Agama', 'Wajib', 13),
  ('Informatika', 'Wajib', 14),
  ('Seni Budaya', 'Wajib', 15),
  ('PJOK', 'Wajib', 16);

-- -------------------------------------------------------------------------
-- 3. ACCESS CODES — kode akses pendaftaran tentor, dikelola dari panel admin
-- -------------------------------------------------------------------------
create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  usage_limit int not null check (usage_limit > 0),
  usage_count int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 4. TENTOR_PROFILES — data tambahan khusus role tentor
-- -------------------------------------------------------------------------
create table public.tentor_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  kelas text not null,
  rating numeric(3, 2) not null default 3.0,
  rating_count int not null default 0,
  rating_sum numeric not null default 0,
  total_answered int not null default 0,
  is_available boolean not null default false,
  is_teaching boolean not null default false,
  access_code_verified boolean not null default false,
  access_code_id uuid references public.access_codes (id),
  created_at timestamptz not null default now()
);

create table public.tentor_subjects (
  tentor_id uuid not null references public.tentor_profiles (profile_id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  primary key (tentor_id, subject_id)
);

-- -------------------------------------------------------------------------
-- 5. QUESTIONS — satu baris per pertanyaan; juga berfungsi sebagai "sesi"
--    begitu ada tentor yang menerima (status berjalan -> selesai / hangus)
-- -------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id),
  content text not null,
  photo_url text,
  status text not null default 'menunggu'
    check (status in ('menunggu', 'berjalan', 'selesai', 'hangus')),
  accepted_tentor_id uuid references public.profiles (id),
  accepted_at timestamptz,
  ended_at timestamptz,
  rating_given numeric(2, 1) check (rating_given is null or (rating_given >= 0.1 and rating_given <= 5.0)),
  auto_closed boolean not null default false,
  last_broadcast_at timestamptz not null default now(),
  broadcast_round int not null default 1,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create index questions_mentee_idx on public.questions (mentee_id);
create index questions_tentor_idx on public.questions (accepted_tentor_id);
create index questions_status_idx on public.questions (status);

-- -------------------------------------------------------------------------
-- 6. QUESTION_ASSIGNMENTS — tentor mana saja yang ditawari sebuah pertanyaan
-- -------------------------------------------------------------------------
create table public.question_assignments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  tentor_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'menunggu'
    check (status in ('menunggu', 'diterima', 'ditolak', 'terlambat')),
  batch_no int not null default 1,
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (question_id, tentor_id)
);

create index assignments_tentor_idx on public.question_assignments (tentor_id);
create index assignments_question_idx on public.question_assignments (question_id);

-- -------------------------------------------------------------------------
-- 7. MESSAGES — chat per pertanyaan/sesi
-- -------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'teks' check (type in ('teks', 'foto', 'suara')),
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_question_idx on public.messages (question_id, created_at);

-- -------------------------------------------------------------------------
-- 8. SITE_REVIEWS — ulasan untuk website TentorSebaya (bukan rating tentor)
-- -------------------------------------------------------------------------
create table public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- TRIGGER: saat questions.status berubah jadi 'selesai', update rating &
-- penghitung total_answered milik tentor secara konsisten di satu tempat.
-- Berlaku baik untuk penutupan manual (mentee kasih bintang) maupun
-- auto-close 24 jam (rating dianggap 3.0).
-- =========================================================================
create or replace function public.handle_question_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_rating numeric(2,1);
begin
  if new.status = 'selesai' and (old.status is distinct from 'selesai') then
    effective_rating := coalesce(new.rating_given, 3.0);

    update public.tentor_profiles
    set
      total_answered = total_answered + 1,
      rating_count = rating_count + 1,
      rating_sum = rating_sum + effective_rating,
      -- pembulatan 1 desimal, nilai .05 ke atas dibulatkan naik (ROUND numeric bawaan Postgres)
      rating = round((rating_sum + effective_rating) / (rating_count + 1), 1),
      is_teaching = false
    where profile_id = new.accepted_tentor_id;
  end if;

  return new;
end;
$$;

create trigger trg_question_completed
  after update on public.questions
  for each row
  execute function public.handle_question_completed();

-- =========================================================================
-- GRANTS — wajib eksplisit sejak perubahan default Supabase (berlaku untuk
-- semua project baru mulai akhir Mei 2026): tabel baru di schema public
-- TIDAK otomatis bisa diakses lewat Data API (yang dipakai supabase-js)
-- walau RLS & policy sudah benar. Tanpa GRANT ini, semua query dari kode
-- (baik pakai anon key maupun service role key) akan ditolak dengan error
-- "permission denied for table ...". RLS di bawah tetap jadi penjaga utama
-- SIAPA boleh lihat baris yang MANA; GRANT di sini cuma membuka akses
-- tabelnya secara prinsip ke masing-masing role.
-- =========================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on public.subjects to anon, authenticated, service_role;
grant select on public.site_reviews to anon, authenticated;
grant select, insert on public.site_reviews to service_role;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

grant select on public.tentor_profiles to authenticated;
grant select, insert, update, delete on public.tentor_profiles to service_role;

grant select on public.tentor_subjects to authenticated;
grant select, insert, update, delete on public.tentor_subjects to service_role;

grant select, insert, update, delete on public.access_codes to service_role;

grant select on public.questions to authenticated;
grant select, insert, update, delete on public.questions to service_role;

grant select on public.question_assignments to authenticated;
grant select, insert, update, delete on public.question_assignments to service_role;

grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.messages to service_role;

-- =========================================================================
-- ROW LEVEL SECURITY
-- Prinsip: SELECT boleh lewat client (anon key + sesi user) sesuai kebutuhan
-- tampilan; semua INSERT/UPDATE/DELETE pada tabel inti dilakukan lewat API
-- route Next.js memakai service role key (yang otomatis melewati RLS),
-- supaya logika matching/rating/kode-akses tidak bisa dimanipulasi dari
-- browser. Pesan chat dikecualikan: boleh insert langsung dari client biar
-- realtime tetap ringan.
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.tentor_profiles enable row level security;
alter table public.tentor_subjects enable row level security;
alter table public.subjects enable row level security;
alter table public.access_codes enable row level security;
alter table public.questions enable row level security;
alter table public.question_assignments enable row level security;
alter table public.messages enable row level security;
alter table public.site_reviews enable row level security;

-- subjects: referensi publik, aman dibaca siapa saja
create policy "subjects_select_all" on public.subjects
  for select using (true);

-- profiles: pengguna login boleh lihat semua profil (perlu buat nampilin
-- lawan chat / kartu tentor). Kolom password_hash tidak pernah di-select
-- dari kode client — lihat komentar di definisi kolom.
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

-- tentor_profiles: dibaca siapa saja yang login (perlu buat proses matching
-- & kartu profil tentor di chat)
create policy "tentor_profiles_select_authenticated" on public.tentor_profiles
  for select using (auth.role() = 'authenticated');

create policy "tentor_subjects_select_authenticated" on public.tentor_subjects
  for select using (auth.role() = 'authenticated');

-- access_codes: TIDAK ADA policy select/insert untuk authenticated/anon.
-- Hanya bisa diakses lewat service role key di server (panel admin &
-- endpoint pendaftaran tentor).

-- questions: mentee pemilik, tentor yang sudah diterima, atau tentor yang
-- sedang ditawari (ada baris di question_assignments) boleh melihat.
create policy "questions_select_participant" on public.questions
  for select using (
    auth.uid() = mentee_id
    or auth.uid() = accepted_tentor_id
    or exists (
      select 1 from public.question_assignments qa
      where qa.question_id = questions.id and qa.tentor_id = auth.uid()
    )
  );

-- question_assignments: tentor hanya melihat tawaran miliknya sendiri
create policy "assignments_select_own" on public.question_assignments
  for select using (auth.uid() = tentor_id);

-- messages: hanya mentee & tentor yang terlibat pada pertanyaan terkait
create policy "messages_select_participant" on public.messages
  for select using (
    exists (
      select 1 from public.questions q
      where q.id = messages.question_id
        and (auth.uid() = q.mentee_id or auth.uid() = q.accepted_tentor_id)
    )
  );

-- messages: boleh insert langsung dari client (bukan lewat API route) asal
-- pengirim = diri sendiri, dia peserta sesi itu, dan sesinya sedang berjalan
create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.questions q
      where q.id = messages.question_id
        and q.status = 'berjalan'
        and (auth.uid() = q.mentee_id or auth.uid() = q.accepted_tentor_id)
    )
  );

-- site_reviews: siapa saja (termasuk pengunjung belum login) boleh baca,
-- hanya pengguna login yang boleh menulis ulasan atas namanya sendiri
create policy "site_reviews_select_all" on public.site_reviews
  for select using (true);

create policy "site_reviews_insert_own" on public.site_reviews
  for insert with check (author_id = auth.uid());

-- Catatan keamanan tambahan ada di README.md (mis. opsi mengganti storage
-- bucket publik dengan signed URL kalau ingin privasi lebih ketat).
