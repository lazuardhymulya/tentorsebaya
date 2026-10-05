import type { SupabaseClient } from '@supabase/supabase-js';
import { findEligibleTentors, weightedSelect, MAX_TENTORS_PER_BROADCAST } from './matching';

interface BroadcastResult {
  assignedTentorIds: string[];
}

/**
 * Isi slot antrian penerima pertanyaan sampai maksimal 5 tentor yang
 * sedang "menunggu" respons.
 *
 * Prioritas: tentor yang BELUM PERNAH ditawari pertanyaan ini dulu (baik
 * baru online, atau baru pertama kali dicek). Kalau kandidat segar tidak
 * cukup untuk mengisi slot yang tersisa, baru pakai tentor yang sebelumnya
 * kena giliran "terlambat" (dilewati saat rotasi 1 jam) — tapi tentor yang
 * sudah eksplisit menolak ('ditolak') tidak pernah ditawari ulang untuk
 * pertanyaan yang sama.
 */
export async function fillBroadcastSlots(
  admin: SupabaseClient,
  question: { id: string; subject_id: string }
): Promise<BroadcastResult> {
  const { data: existing, error: existingErr } = await admin
    .from('question_assignments')
    .select('tentor_id, status')
    .eq('question_id', question.id);

  if (existingErr) throw existingErr;

  const pendingIds = (existing ?? [])
    .filter((a) => a.status === 'menunggu')
    .map((a) => a.tentor_id as string);
  const rejectedIds = (existing ?? [])
    .filter((a) => a.status === 'ditolak')
    .map((a) => a.tentor_id as string);
  const everTriedIds = (existing ?? []).map((a) => a.tentor_id as string);

  const slotsNeeded = MAX_TENTORS_PER_BROADCAST - pendingIds.length;
  if (slotsNeeded <= 0) return { assignedTentorIds: [] };

  // Pass 1: kandidat yang benar-benar baru (belum pernah punya baris assignment)
  let candidates = await findEligibleTentors(admin, question.subject_id, everTriedIds);
  let selected = weightedSelect(candidates, slotsNeeded);

  // Pass 2: kalau masih kurang, izinkan pakai tentor yang tadinya 'terlambat'
  // (bukan yang 'ditolak') — supaya kasus tentor cocok sedikit tetap jalan.
  if (selected.length < slotsNeeded) {
    const stillExclude = [...rejectedIds, ...pendingIds, ...selected.map((s) => s.tentorId)];
    candidates = await findEligibleTentors(admin, question.subject_id, stillExclude);
    const extra = weightedSelect(candidates, slotsNeeded - selected.length);
    selected = [...selected, ...extra];
  }

  if (selected.length === 0) return { assignedTentorIds: [] };

  const { error: insertErr } = await admin.from('question_assignments').insert(
    selected.map((c) => ({
      question_id: question.id,
      tentor_id: c.tentorId,
      status: 'menunggu',
    }))
  );
  if (insertErr) throw insertErr;

  return { assignedTentorIds: selected.map((c) => c.tentorId) };
}
