import Link from 'next/link';
import { UserLink } from './UserLink';
import type { PostCardData } from '@/lib/types';

export function PostCard({ post }: { post: PostCardData }) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <article className="card transition hover:border-brand-300">
      <div className="flex flex-wrap items-center gap-2">
        {post.subject && (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{post.subject}</span>
        )}
        {post.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-600">
            {tag}
          </span>
        ))}
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-ink-900">
        <Link href={`/forum/${post.id}`} className="hover:text-brand-600">
          {post.title}
        </Link>
      </h3>
      <p className="mt-2 text-sm text-ink-500">
        Ditanya oleh {post.menteeUsername ? <UserLink username={post.menteeUsername} className="text-sm" /> : <span>Anonim</span>}
        {post.tentorUsername && (
          <>
            {' · dijawab '}
            <UserLink username={post.tentorUsername} className="text-sm" />
          </>
        )}
        {date && <span> · {date}</span>}
      </p>
    </article>
  );
}
