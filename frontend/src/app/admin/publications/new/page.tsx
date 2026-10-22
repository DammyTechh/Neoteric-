'use client';

import { AdminShell } from '@/components/admin/Shell';
import { PublicationEditor } from '@/components/admin/PublicationEditor';

export default function NewPublicationPage() {
  return (
    <AdminShell
      title="New publication"
      description="Write it here, or create it and import a document."
    >
      <PublicationEditor />
    </AdminShell>
  );
}
