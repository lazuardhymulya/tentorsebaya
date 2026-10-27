import { Star } from 'lucide-react';
import { Avatar } from './Avatar';
import { UserLink } from './UserLink';
import type { PersonResult } from '@/lib/search';

export function PersonCard({ person }: { person: PersonResult }) {
  const isTentor = person.role === 'tentor';
  return (
    <article className="card flex gap-4 transition hover:border-brand-300">
      <Avatar username={person.username} photoUrl={person.photoUrl} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <UserLink username={person.username} className="text-base" />
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isTentor ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600'
            }`}
          >
            {isTentor ? 'Tentor' : 'Mentee'}
          </span>
          {isTentor && person.tier && (
            <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
              Tingkat {person.tier}
            </span>
          )}
          {isTentor && person.rating !== null && (
            <span className="flex items-center gap-1 text-xs font-medium text-ink-500">
              <Star size={12} className="fill-accent-500 text-accent-500" />
              {person.rating.toFixed(1)}
              <span className="font-normal text-ink-400">
                {person.ratingCount > 0 ? `(${person.ratingCount} dinilai)` : '(belum dinilai)'}
              </span>
            </span>
          )}
        </div>

        {(person.subjects.length > 0 || person.tags.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {person.subjects.slice(0, 4).map((name) => (
              <span key={name} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700">{name}</span>
            ))}
            {person.subjects.length > 4 && <span className="text-xs text-ink-400">+{person.subjects.length - 4}</span>}
            {person.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-ink-200 px-2.5 py-0.5 text-xs text-ink-600">{tag}</span>
            ))}
          </div>
        )}

        {person.bio && <p className="mt-2 line-clamp-2 text-sm text-ink-600">{person.bio}</p>}
      </div>
    </article>
  );
}
