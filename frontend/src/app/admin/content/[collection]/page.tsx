'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/admin/Shell';
import { CollectionManager } from '@/components/admin/CollectionManager';
import { COLLECTIONS, findCollection } from '@/components/admin/collections';
import { Button, EmptyState, Panel } from '@/components/admin/ui';

/**
 * One route for all six content collections.
 *
 * The collection is a URL segment rather than six sibling folders, so adding
 * a collection means adding an entry to `collections.ts` — not a new page
 * that will drift from the others the first time one of them is improved.
 */
export default function CollectionPage() {
  const params = useParams<{ collection: string }>();
  const spec = findCollection(params.collection);

  if (!spec) {
    return (
      <AdminShell title="Not found">
        <Panel padded={false}>
          <EmptyState
            icon="search_off"
            title="No such collection"
            description={`“${params.collection}” is not something this dashboard manages.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {COLLECTIONS.map((collection) => (
                  <Link key={collection.key} href={`/admin/content/${collection.key}`}>
                    <Button variant="ghost" icon={collection.icon}>
                      {collection.plural}
                    </Button>
                  </Link>
                ))}
              </div>
            }
          />
        </Panel>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={spec.plural} description={spec.description}>
      <CollectionManager spec={spec} />
    </AdminShell>
  );
}
