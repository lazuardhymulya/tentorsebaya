import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfTodayWib } from './time';
import type { TentorCandidate } from './types';

export const MAX_TENTORS_PER_BROADCAST = 5;
export const MAX_QUESTIONS_PER_DAY = 5;
export const RESEND_INTERVAL_MS = 60 * 60 * 1000; // 1 jam
export const QUESTION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 jam
export const SESSION_AUTO_CLOSE_MS = 24 * 60 * 60 * 1000; // 24 jam mentee tidak mengakhiri sesi

/** Tingkat 1..5 dari rating, sesuai rentang di dokumen spesifikasi. */
export function ratingToTier(rating: number): number {
  if (rating <= 1.0) return 1;
  if (rating <= 2.0) return 2;
  if (rating <= 3.0) return 3;
  if (rating <= 4.0) return 4;
  return 5;
}

/**
 * Tahap 1+2+3+4: cari kandidat tentor yang cocok mapel, sedang available,
 * tidak sedang mengajar, belum lewat batas 5 pertanyaan/hari, dan hitung
 * metrik yang dipakai untuk perankingan (tier, total dijawab, dijawab hari ini).
 *
 * excludeTentorIds: tentor yang tidak boleh dipertimbangkan lagi di panggilan
 * ini (mis. yang sudah punya baris question_assignments untuk pertanyaan ini).
 */
export async function findEligibleTentors(
  supabase: SupabaseClient,
  subjectId: string,
  excludeTentorIds: string[] = []
): Promise<TentorCandidate[]> {
  const { data: subjectTentors, error: subjectErr } = await supabase
    .from('tentor_subjects')
    .select('tentor_id')
    .eq('subject_id', subjectId);

  if (subjectErr) throw subjectErr;
  const candidateIds = (subjectTentors ?? [])
    .map((row) => row.tentor_id as string)
    .filter((id) => !excludeTentorIds.includes(id));

  if (candidateIds.length === 0) return [];

  const { data: tentors, error: tentorErr } = await supabase
    .from('tentor_profiles')
    .select('profile_id, rating, total_answered')
    .in('profile_id', candidateIds)
    .eq('is_available', true)
    .eq('is_teaching', false)
    .eq('access_code_verified', true);

  if (tentorErr) throw tentorErr;
  if (!tentors || tentors.length === 0) return [];

  // Berapa banyak masing-masing tentor sudah selesai menjawab HARI INI (WIB),
  // dipakai untuk batas 5/hari (tahap 2) sekaligus urutan "opportunity" (tahap 4).
  const todayStart = startOfTodayWib().toISOString();
  const { data: answeredToday, error: answeredErr } = await supabase
    .from('questions')
    .select('accepted_tentor_id')
    .in(
      'accepted_tentor_id',
      tentors.map((t) => t.profile_id)
    )
    .eq('status', 'selesai')
    .gte('ended_at', todayStart);

  if (answeredErr) throw answeredErr;

  const todayCountByTentor = new Map<string, number>();
  for (const row of answeredToday ?? []) {
    const id = row.accepted_tentor_id as string;
    todayCountByTentor.set(id, (todayCountByTentor.get(id) ?? 0) + 1);
  }

  return tentors
    .map((t) => ({
      tentorId: t.profile_id as string,
      rating: Number(t.rating),
      totalAnswered: t.total_answered as number,
      answeredToday: todayCountByTentor.get(t.profile_id as string) ?? 0,
      tier: ratingToTier(Number(t.rating)),
    }))
    .filter((c) => c.answeredToday < MAX_QUESTIONS_PER_DAY); // tahap 2: batas harian
}

/**
 * Tahap 3+4: kelompokkan per tingkat, lalu di dalam tingkat urutkan dari
 * yang HARI INI paling sedikit menjawab (opportunity); kalau seri, dari
 * yang total jawaban sepanjang waktu paling banyak (performance score).
 */
function rankByTier(candidates: TentorCandidate[]): Map<number, TentorCandidate[]> {
  const byTier = new Map<number, TentorCandidate[]>();
  for (const c of candidates) {
    const list = byTier.get(c.tier) ?? [];
    list.push(c);
    byTier.set(c.tier, list);
  }
  for (const list of byTier.values()) {
    list.sort((a, b) => {
      if (a.answeredToday !== b.answeredToday) return a.answeredToday - b.answeredToday;
      return b.totalAnswered - a.totalAnswered;
    });
  }
  return byTier;
}

/**
 * Tahap 5: ambil peringkat pertama dari tiap tingkat (T5 -> T1), ulangi ambil
 * peringkat berikutnya kalau masih kurang dari target, sampai target
 * terpenuhi atau kandidat habis.
 */
export function weightedSelect(
  candidates: TentorCandidate[],
  targetCount: number
): TentorCandidate[] {
  const byTier = rankByTier(candidates);
  const tierOrder = [5, 4, 3, 2, 1];
  const pointer: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const selected: TentorCandidate[] = [];

  let madeProgress = true;
  while (selected.length < targetCount && madeProgress) {
    madeProgress = false;
    for (const tier of tierOrder) {
      if (selected.length >= targetCount) break;
      const list = byTier.get(tier) ?? [];
      const idx = pointer[tier];
      if (idx < list.length) {
        selected.push(list[idx]);
        pointer[tier] = idx + 1;
        madeProgress = true;
      }
    }
  }

  return selected;
}
