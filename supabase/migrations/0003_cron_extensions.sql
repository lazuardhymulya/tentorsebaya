-- =========================================================================
-- Mengaktifkan pg_cron & pg_net supaya Postgres bisa menjadwalkan panggilan
-- HTTP berkala ke endpoint /api/cron/retry-questions milik aplikasi.
--
-- Kenapa lewat sini, bukan Vercel Cron? Paket gratis Vercel (Hobby) cuma
-- boleh menjalankan cron job 1x/hari, sedangkan mekanisme rotasi 1 jam &
-- pemantauan tentor baru di aplikasi ini butuh jalan jauh lebih sering.
-- pg_cron di Supabase tidak punya batasan itu, gratis di semua paket.
--
-- Pendaftaran jadwalnya (cron.schedule(...)) SENGAJA tidak dimasukkan di
-- migrasi ini karena butuh URL production kamu (yang baru ada setelah
-- deploy ke Vercel) dan CRON_SECRET. Jalankan perintah itu manual lewat
-- SQL Editor Supabase — lihat README.md bagian "Jadwalkan cron job".
-- =========================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
