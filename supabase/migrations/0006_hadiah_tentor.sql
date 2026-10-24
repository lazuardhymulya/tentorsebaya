-- =========================================================================
-- Kado untuk tentor: penanda "kado belum dibuka" pada sesi yang sudah selesai.
-- Diisi true oleh server saat sesi berakhir (mentee menilai, atau sesi ditutup
-- otomatis), lalu jadi false lagi begitu tentor menutup kadonya.
--
-- Jalankan SEBELUM kode baru di-deploy (sama seperti 0005).
-- =========================================================================

alter table public.questions add column if not exists gift_pending boolean not null default false;

create index if not exists questions_gift_pending_idx
  on public.questions (accepted_tentor_id)
  where gift_pending;
