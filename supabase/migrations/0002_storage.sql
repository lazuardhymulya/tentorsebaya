-- =========================================================================
-- Storage buckets untuk foto soal & file chat (foto/voice note)
--
-- Kedua bucket dibuat PUBLIC (bisa dibaca lewat URL publik tanpa login)
-- supaya <img>/<audio> di frontend gampang, tapi tidak ada policy insert
-- untuk role anon/authenticated — artinya upload cuma bisa lewat server
-- (service role key di API route), tidak bisa langsung dari browser.
--
-- Trade-off privasi: siapa pun yang tahu/menebak URL filenya (nama file
-- diberi awalan UUID acak) bisa membukanya tanpa login. Untuk privasi
-- lebih ketat, ganti public jadi false lalu buat endpoint yang mengembalikan
-- signed URL (createSignedUrl) hanya untuk peserta chat terkait.
-- =========================================================================

insert into storage.buckets (id, name, public)
values
  ('question-photos', 'question-photos', true),
  ('chat-files', 'chat-files', true)
on conflict (id) do nothing;
