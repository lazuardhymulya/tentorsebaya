/* eslint-disable @next/next/no-img-element */
const SIZES = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-24 w-24 text-3xl',
} as const;

/** Foto profil kalau ada, kalau tidak pakai huruf awal username (bukan foto akun Google). */
export function Avatar({
  username,
  photoUrl,
  size = 'md',
}: {
  username: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
}) {
  const cls = SIZES[size];
  if (photoUrl) {
    return <img src={photoUrl} alt={`Foto profil ${username}`} className={`${cls} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-display font-semibold uppercase text-brand-700`}
      aria-hidden="true"
    >
      {username.charAt(0)}
    </span>
  );
}
