/**
 * Semua batas "hari" di aplikasi ini mengikuti WIB (UTC+7), sesuai
 * kesepakatan: limit 5 pertanyaan/hari tentor reset jam 00:00 WIB.
 */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Waktu sekarang, dinyatakan sebagai jam-menit-detik WIB (bukan UTC). */
function toWibParts(date: Date) {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: wib.getUTCFullYear(),
    month: wib.getUTCMonth(),
    day: wib.getUTCDate(),
  };
}

/** Awal hari ini (00:00 WIB) dinyatakan sebagai Date UTC yang setara. */
export function startOfTodayWib(reference: Date = new Date()): Date {
  const { year, month, day } = toWibParts(reference);
  // 00:00 WIB = 17:00 UTC hari sebelumnya (WIB = UTC+7)
  const startUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0) - WIB_OFFSET_MS;
  return new Date(startUtcMs);
}

export function endOfTodayWib(reference: Date = new Date()): Date {
  const start = startOfTodayWib(reference);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
