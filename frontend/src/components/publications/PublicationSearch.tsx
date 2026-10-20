'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * Search box for the publications index.
 *
 * Submits a real navigation rather than filtering in place, so a search is a
 * URL that can be shared, bookmarked and reached with the back button — and
 * so the server does the filtering against the full-text index instead of the
 * browser filtering one page of results.
 */
export function PublicationSearch({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const query = new URLSearchParams();
    // Keep the category filter; drop the page, since results have changed.
    const category = searchParams.get('category');
    if (category) query.set('category', category);
    if (value.trim()) query.set('q', value.trim());

    const suffix = query.toString();
    router.push(suffix ? `/publications?${suffix}` : '/publications');
  }

  return (
    <form onSubmit={handleSubmit} role="search">
      <label htmlFor="publication-search" className="sr-only">
        Search publications
      </label>

      <div className="relative">
        <Icon
          name="search"
          size="sm"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary-300"
        />

        <input
          id="publication-search"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search publications…"
          className="field border-white/20 bg-white/10 pl-11 pr-28 text-white placeholder:text-primary-300 focus:border-secondary focus:ring-secondary/20"
        />

        <button type="submit" className="btn-secondary btn-sm absolute right-1.5 top-1/2 -translate-y-1/2">
          Search
        </button>
      </div>
    </form>
  );
}
