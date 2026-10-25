# Pilots

Platform tanya-jawab pelajar SMA: mentee mengajukan pertanyaan, sistem otomatis
mencocokkan ke tentor sesama pelajar yang sedang online (mirip mekanisme
pencarian driver ojek online), lalu keduanya lanjut chat sampai soal selesai.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind**, **Supabase**
(database Postgres, Auth, Storage, Realtime, dan Cron), di-deploy ke **Vercel**.
Semua bagian di bawah punya tier gratis yang cukup untuk pemakaian ±1 bulan.

---

## 0. Sebelum mulai — akun yang perlu disiapkan

1. Akun [Supabase](https://supabase.com) (gratis)
2. Akun [Vercel](https://vercel.com) (gratis) — sign up pakai akun GitHub supaya gampang deploy
3. Akun [Google Cloud Console](https://console.cloud.google.com) (gratis, buat bikin Client ID login Google)
4. Node.js versi 18 ke atas terpasang di komputer (untuk coba jalan lokal) — download di [nodejs.org](https://nodejs.org)

---

## 1. Buat project Supabase & jalankan migrasi

1. Di dashboard Supabase, klik **New Project**. Catat **Database Password** yang kamu buat.
2. Setelah project jadi (tunggu ~2 menit), buka menu **SQL Editor** di sidebar kiri.
3. Buka file `supabase/migrations/0001_init.sql` di project ini, copy semua isinya, paste ke SQL Editor, klik **Run**.
4. Ulangi persis sama untuk `supabase/migrations/0002_storage.sql`.
5. Ulangi persis sama untuk `supabase/migrations/0003_cron_extensions.sql`.

   Urutannya harus 0001 → 0002 → 0003 karena saling bergantung. Setelah itu jalankan juga `0004_realtime.sql` (update otomatis tanpa refresh) `0005_profil_ulasan.sql` (profil, ulasan teks, judul pertanyaan, foto profil), `0006_hadiah_tentor.sql` (kado untuk tentor), dan `0007_forum.sql` (forum diskusi, komentar, laporan) dengan cara yang sama.

6. Ambil kredensial API: buka **Project Settings** (ikon gear) → **API**.
   Kamu akan butuh 3 nilai ini nanti:
   - **Project URL** → jadi `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → jadi `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (klik "reveal") → jadi `SUPABASE_SERVICE_ROLE_KEY` — **rahasiakan ini, jangan pernah taruh di kode/commit ke GitHub**

---

## 2. Buat Google OAuth Client ID (buat tombol "Lanjut dengan Google")

1. Buka [Google Cloud Console](https://console.cloud.google.com) → buat project baru (nama bebas).
2. Menu **APIs & Services** → **OAuth consent screen** → pilih **External** → isi nama app "Pilots" & email kamu → simpan (status Testing juga tidak masalah untuk skala sekolah).
3. Menu **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID** → tipe **Web application**.
4. Di bagian **Authorized redirect URIs**, tambahkan URL callback Supabase kamu (bentuknya seperti ini, ambil dari Supabase: **Authentication** → **Providers** → **Google**, di sana Supabase sudah menyediakan URL redirect yang harus dicopy ke sini):
   ```
   https://<project-id-kamu>.supabase.co/auth/v1/callback
   ```
5. Klik **Create**. Copy **Client ID** dan **Client Secret** yang muncul.
6. Balik ke Supabase: **Authentication** → **Providers** → **Google** → aktifkan (toggle ON) → paste Client ID & Client Secret tadi → **Save**.
7. **Penting kalau penggunanya bakal lebih dari ~100 orang**: selama status consent screen masih "Testing", Google membatasi maksimal 100 orang total yang bisa login selamanya. Begitu siap dipakai banyak orang, buka lagi halaman OAuth consent screen / Google Auth Platform → cari **Publishing status** → klik **Publish App**. Karena aplikasi ini cuma minta data dasar (nama & email, bukan data sensitif), publish ini tidak perlu menunggu proses review Google — langsung aktif dan batas 100 orang hilang.

---

## 3. Isi environment variable

1. Di folder project ini, copy `.env.example` jadi `.env.local`:
   ```
   cp .env.example .env.local
   ```
2. Isi tiap barisnya:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → dari langkah 1.6
   - `ADMIN_SESSION_SECRET` → ketik string acak panjang bebas (buat sendiri, contoh: hasil dari `openssl rand -hex 32` di terminal)
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` → username & password akun admin pertamamu, bebas kamu tentukan sendiri
   - `NEXT_PUBLIC_SITE_URL` → biarkan `http://localhost:3000` dulu untuk coba lokal
   - `CRON_SECRET` → string acak lain, beda dari `ADMIN_SESSION_SECRET`

---

## 4. Coba jalan di komputer sendiri (opsional tapi disarankan)

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Coba alur daftar mentee/tentor. Kalau login
Google gagal redirect, cek lagi redirect URI di langkah 2.4.

> Tombol "Terima" pada notifikasi tentor, chat realtime, dan toggle
> "Tersedia" semuanya butuh koneksi ke Supabase asli — pastikan `.env.local`
> sudah benar sebelum menguji fitur-fitur ini.

---

## 5. Deploy ke Vercel

1. Push project ini ke repo GitHub baru (`git init`, `git add .`, `git commit -m "init"`, buat repo di GitHub, `git push`).
2. Di Vercel, **Add New Project** → import repo GitHub tadi.
3. Di step **Environment Variables**, masukkan semua isi `.env.local` kamu satu-satu (nama & value sama persis).
4. Untuk `NEXT_PUBLIC_SITE_URL`, isi dengan URL Vercel kamu nanti, contoh `https://tentorsebaya.vercel.app` (bisa diedit lagi setelah deploy pertama kali selesai dan kamu tahu URL-nya).
5. Klik **Deploy**.
6. Setelah selesai, buka **Authentication → URL Configuration** di Supabase, tambahkan URL Vercel kamu ke **Redirect URLs** (mis. `https://tentorsebaya.vercel.app/auth/callback`) supaya login Google tidak ditolak di production.

---

## 6. Jadwalkan cron job (rotasi tawaran per jam & kedaluwarsa 24 jam)

Paket gratis Vercel cuma boleh menjalankan cron job 1x/hari, terlalu jarang
untuk rotasi tiap 1 jam di aplikasi ini. Solusinya: jadwalkan lewat
**Supabase Cron** (pg_cron), yang gratis di semua paket dan bisa jalan tiap
beberapa menit.

Di Supabase **SQL Editor**, jalankan (ganti `<URL-VERCEL-KAMU>` dan
`<CRON_SECRET-KAMU>` sesuai punyamu):

```sql
select cron.schedule(
  'tentorsebaya-retry-questions',
  '*/5 * * * *', -- tiap 5 menit
  $$
  select net.http_get(
    url := 'https://<URL-VERCEL-KAMU>/api/cron/retry-questions',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET-KAMU>')
  );
  $$
);
```

Cek jadwal aktif dengan `select * from cron.job;`. Kalau suatu saat mau
menghapusnya: `select cron.unschedule('tentorsebaya-retry-questions');`.

> Kenapa tiap 5 menit, bukan tiap detik? Cukup buat rotasi 1 jam / kedaluwarsa
> 24 jam yang tidak butuh presisi detik, dan hemat kuota pemanggilan function
> Vercel (5 menit = ±8.600 panggilan/bulan, jauh di bawah batas gratis).

---

## 7. Buat kode akses pertama untuk tentor

1. Buka `https://<url-kamu>/admin/login`, masuk pakai `ADMIN_USERNAME` /
   `ADMIN_PASSWORD` yang kamu isi di environment variable.
2. Di halaman **Kode Akses Tentor**, klik **Buat** untuk generate kode baru
   (atau isi kode sendiri), tentukan berapa kali kode itu boleh dipakai.
3. Bagikan kode itu ke calon tentor untuk dipakai sekali di pendaftaran
   pertama mereka.

---

## Bagaimana matching bekerja (ringkas)

1. Mentee mengajukan pertanyaan → dicek tentor yang cocok mapelnya, sedang
   "Tersedia", tidak sedang mengajar, dan belum kena batas 5 pertanyaan
   selesai/hari (reset 00:00 WIB).
2. Kandidat dikelompokkan per tingkat rating (T1–T5), lalu di tiap tingkat
   diurutkan dari yang hari ini paling sedikit menjawab (kalau seri, dari
   total jawaban terbanyak sepanjang waktu).
3. Diambil bergiliran dari tingkat tertinggi ke terendah sampai maksimal 5
   tentor ditawari sekaligus.
4. Siapa yang menekan "Terima" duluan, dialah yang dapat sesinya (tawaran ke
   tentor lain otomatis jadi "terlambat").
5. Kalau dalam 1 jam belum ada yang menerima, tawaran yang menggantung
   ditandai lewat dan sistem mencari 5 tentor lain (cron tiap 5 menit yang
   memantau ini — lihat bagian 6).
6. Kalau tentor yang cocok kurang dari 5, sistem terus memantau tentor baru
   yang online untuk mengisi slot yang kosong.
7. Kalau 24 jam sejak diajukan tetap tidak ada yang menerima, pertanyaan
   ditandai kedaluwarsa dan mentee diberi tahu.
8. Sesi yang sudah diterima tapi mentee-nya menghilang >24 jam tanpa
   mengakhiri, otomatis ditutup dengan rating dianggap 3.0.
9. Rating tentor = rata-rata dari seluruh penilaian yang pernah diterima,
   dibulatkan 1 desimal.

---

## Batasan yang perlu kamu tahu (jujur, bukan disembunyikan)

- **Foto & voice note bersifat publik lewat URL**: bucket storage dibuat
  publik-baca supaya implementasinya sederhana. Nama filenya diberi awalan
  acak (UUID pertanyaan), jadi tidak nongol di mana-mana, tapi siapa pun
  yang tahu link persisnya bisa membukanya tanpa login. Untuk privasi lebih
  ketat, bucket bisa diganti private + pakai signed URL (butuh sedikit kerja
  tambahan, tidak termasuk di versi ini).
- **Password disimpan terpisah dari sesi Google**: kolom `password_hash` di
  tabel `profiles` cuma boleh dibaca/ditulis lewat server (service role).
  Jangan pernah menambahkan `select('*')` dari kode yang jalan di browser
  pada tabel ini.
- **RLS (Row Level Security) sudah aktif** di semua tabel dengan kebijakan
  dasar yang wajar untuk skala proyek ini, tapi belum di-audit setingkat
  aplikasi produksi besar. Kalau nanti mau dipakai lebih serius/permanen,
  ada baiknya direview ulang.
- **Cron jalan tiap 5 menit**, bukan real-time detik-ke-detik. Untuk
  kebutuhan rotasi per jam & kedaluwarsa 24 jam ini sudah cukup presisi.
- Video call / kirim video **belum ada** di versi ini (sesuai kesepakatan —
  fitur foto & voice note dulu, video menyusul kalau dibutuhkan nanti).

---

## Foto di bawah footer

Taruh foto bernama persis `foto-footer.jpg` di folder `public`. Kalau file itu belum ada, bagian foto otomatis tidak tampil. Foto dipotong (bukan dilebarkan) mengikuti ukuran layar; titik fokusnya bisa digeser lewat `FOOTER_PHOTO_FOCUS` di `src/components/FooterPhoto.tsx`.

---

## Struktur folder singkat

```
src/app/            halaman & API routes (Next.js App Router)
src/components/     komponen React yang dipakai berulang (Navbar, Footer, dst.)
src/lib/            logika inti: matching.ts, broadcast.ts, supabase client, dll.
supabase/migrations/  skema database, urut dijalankan 0001 → 0002 → 0003
```

Kalau ada yang error atau mau nambah fitur, tinggal bilang ke Claude lagi
sambil kasih tau pesan errornya atau fitur apa yang mau ditambah.
