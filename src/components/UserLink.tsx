import Link from 'next/link';

export function profileHref(username: string): string {
  return `/profil/${encodeURIComponent(username)}`;
}

/** Username yang bisa diklik -> membuka profil publik akun itu. Dipakai ulang di semua halaman. */
export function UserLink({
  username,
  className = '',
  withAt = true,
}: {
  username: string;
  className?: string;
  withAt?: boolean;
}) {
  return (
    <Link
      href={profileHref(username)}
      className={`font-medium text-ink-900 hover:text-brand-600 hover:underline ${className}`}
    >
      {withAt ? '@' : ''}
      {username}
    </Link>
  );
}
