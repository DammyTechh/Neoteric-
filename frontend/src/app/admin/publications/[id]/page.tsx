'use client';

import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/admin/Shell';
import { PublicationEditor } from '@/components/admin/PublicationEditor';

export default function EditPublicationPage() {
  const params = useParams<{ id: string }>();

  return (
    <AdminShell
      title="Edit publication"
      description="Changes reach the website as soon as you save."
    >
      <PublicationEditor publicationId={params.id} />
    </AdminShell>
  );
}
