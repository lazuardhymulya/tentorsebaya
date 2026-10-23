/**
 * 10 tingkat untuk TAMPILAN (profil & leaderboard), dihitung dari rating:
 * 0.0-0.5 = 1, 0.6-1.0 = 2, ..., 4.6-5.0 = 10.
 *
 * Catatan: ini BUKAN yang dipakai pencocokan tentor — pencocokan tetap
 * memakai 5 tingkat di lib/matching.ts.
 */
export function ratingToDisplayTier(rating: number): number {
  const tenths = Math.round(rating * 10);
  return Math.min(10, Math.max(1, Math.ceil(tenths / 5)));
}
