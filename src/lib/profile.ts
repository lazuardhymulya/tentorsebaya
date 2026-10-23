export const TAUGHT_LEVELS = ['X', 'XI', 'XII'] as const;
export const PRIVACY_OPTIONS = [
  {
    value: 'publik',
    label: 'Publik',
    hint: 'Foto, deskripsi, dan riwayat tampil ke pengguna lain.',
  },
  {
    value: 'terbatas',
    label: 'Terbatas',
    hint: 'Hanya username dan deskripsi singkat yang tampil.',
  },
  {
    value: 'tidak_dapat_dicari',
    label: 'Tidak dapat dicari',
    hint: 'Seperti Terbatas, dan tidak muncul di hasil pencarian umum.',
  },
] as const;

export type PrivacyValue = (typeof PRIVACY_OPTIONS)[number]['value'];

export const USERNAME_REGEX = /^[A-Za-z0-9_.]+$/;
export const USERNAME_HINT = 'Username hanya boleh huruf, angka, titik, dan garis bawah.';

/** "fisika, Astronomi , ,mekanika" -> ['fisika','Astronomi','mekanika'] (unik, dibatasi) */
export function parseTags(raw: string, max: number, maxLength = 30): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(',')) {
    const tag = part.trim().replace(/\s+/g, ' ').slice(0, maxLength);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= max) break;
  }
  return result;
}
