-- =========================================================================
-- Mengaktifkan Supabase Realtime untuk 3 tabel yang butuh update otomatis
-- tanpa refresh: questions (status pertanyaan), question_assignments
-- (tawaran ke tentor), messages (chat). Tanpa ini, kode langganan
-- postgres_changes di sisi aplikasi tidak pernah menerima sinyal apapun.
-- =========================================================================

alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.question_assignments;
alter publication supabase_realtime add table public.messages;