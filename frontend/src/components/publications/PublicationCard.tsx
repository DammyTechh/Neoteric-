import Link from 'next/link';
import { Thumbnail } from './Thumbnail';
import { TiltCard } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { Publication } from '@/lib/types';

interface PublicationCardProps {
  publication: Publication;
  /** `feature` is the large card at the head of a list. */
  variant?: 'default' | 'feature' | 'compact';
  priority?: boolean;
  className?: string;
}

/**
 * One article on the News & Publications index.
 *
 * Always carries a cover thumbnail — a real one when the firm has set it,
 * a generated one otherwise. The whole card is a single link to the article
 * page on this site; nothing here ever points at Google Drive.
 */
export function PublicationCard({
  publication,
  variant = 'default',
  priority = false,
  className,
}: PublicationCardProps) {
  const href = `/publications/${publication.slug}`;
  const category = publication.category;

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className={cn(
          'group flex gap-4 items-start rounded-card p-3 -m-3',
          'transition-colors duration-200 hover:bg-surface-sunken',
          className,
        )}
      >
        <Thumbnail
          src={publication.coverImageUrl}
          alt={publication.coverAlt}
          title={publication.title}
          categoryName={null}
          className="h-20 w-20 shrink-0 rounded-lg"
          sizes="80px"
        />
        <div className="min-w-0 flex-1">
          {category && (
            <span className="eyebrow block mb-1">{category.name}</span>
          )}
          <h3 className="text-h6 font-semibold text-ink line-clamp-2 transition-colors group-hover:text-primary">
            {publication.title}
          </h3>
          <p className="mono text-caption text-ink-soft mt-2">
            {formatDate(publication.publishedAt)} · {publication.readingMinutes} min
          </p>
        </div>
      </Link>
    );
  }

  const isFeature = variant === 'feature';

  return (
    <TiltCard className={cn('h-full', className)} intensity={isFeature ? 1.5 : 2}>
      <article className="card-interactive group h-full overflow-hidden flex flex-col">
        <Link href={href} className="flex h-full flex-col focus:outline-none">
          <Thumbnail
            src={publication.coverImageUrl}
            alt={publication.coverAlt}
            title={publication.title}
            categoryName={category?.name}
            priority={priority}
            className={isFeature ? 'aspect-[16/9] w-full' : 'aspect-[3/2] w-full'}
            sizes={
              isFeature
                ? '(max-width: 1024px) 100vw, 66vw'
                : '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw'
            }
          />

          <div className={cn('flex flex-1 flex-col', isFeature ? 'p-8' : 'p-6')}>
            {/*
              One eyebrow colour for every category. Tinting each with its own
              hue meant ten colours across a single grid, which read as
              decoration rather than as a taxonomy.
            */}
            <div className="flex items-center gap-3 mb-3">
              {category && <span className="eyebrow">{category.name}</span>}
              {publication.isFeatured && !isFeature && (
                <span className="inline-flex items-center gap-1 text-caption text-secondary">
                  <Icon name="star" size="sm" filled />
                </span>
              )}
            </div>

            <h3
              className={cn(
                'text-balance font-semibold text-ink',
                'transition-colors duration-200 group-hover:text-primary',
                isFeature ? 'text-h3' : 'text-h5 line-clamp-3',
              )}
            >
              {publication.title}
            </h3>

            {publication.excerpt && (
              <p
                className={cn(
                  // `text-base` rather than `text-small`: the excerpt is the
                  // only thing telling a reader whether the piece answers
                  // their question, so it has to be readable.
                  'mt-3 text-ink-muted text-pretty',
                  isFeature ? 'text-lead line-clamp-3' : 'text-base line-clamp-2',
                )}
              >
                {publication.excerpt}
              </p>
            )}

            {/* Pushed to the foot so cards of differing text length still
                line their metadata up across a row. */}
            <div className="mt-auto pt-6 flex items-center justify-between gap-4">
              <span className="mono text-caption text-ink-muted">
                {formatDate(publication.publishedAt)}
                <span className="mx-2 opacity-40">/</span>
                {publication.readingMinutes} min read
              </span>

              <span className="inline-flex items-center gap-1 text-small font-medium text-primary">
                Read
                <Icon
                  name="arrow_forward"
                  size="sm"
                  className="transition-transform duration-300 ease-physical group-hover:translate-x-1"
                />
              </span>
            </div>
          </div>
        </Link>
      </article>
    </TiltCard>
  );
}
