'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { PublicationAttachment } from '@/lib/types';

/**
 * Renders an attached PDF inside the article page.
 *
 * This is the piece that keeps the promise of no Drive redirects. A Word file
 * is converted on upload and becomes real article HTML; a PDF cannot be
 * converted faithfully, so it is shown here instead — on our page, in our
 * chrome, with the firm's header still above it.
 *
 * An `<object>` rather than an `<iframe>`: it degrades to its own children
 * when the browser has no PDF plugin, which gives mobile Safari and older
 * Android a sensible download card instead of a blank rectangle.
 */
export function DocumentViewer({ attachment }: { attachment: PublicationAttachment }) {
  const [failed, setFailed] = useState(false);
  const media = attachment.media;

  if (!media) return null;

  const label = attachment.label ?? media.originalName;

  return (
    <figure className="my-10">
      <div className="overflow-hidden rounded-panel border border-surface-line shadow-lift">
        <div className="flex items-center justify-between gap-4 border-b border-surface-line bg-surface-sunken px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
              <Icon name="picture_as_pdf" size="sm" />
            </span>
            <p className="truncate text-small font-medium text-ink">{label}</p>
          </div>

          <a
            href={media.publicUrl}
            download
            className="btn btn-sm btn-ghost shrink-0"
            aria-label={`Download ${label}`}
          >
            <Icon name="download" size="sm" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>

        {failed ? (
          <div className="p-10 text-center">
            <Icon name="description" size="xl" className="text-ink-soft" />
            <p className="mt-4 text-ink-muted text-pretty">
              Your browser cannot display this document inline.
            </p>
            <a href={media.publicUrl} download className="btn-primary mt-6">
              <Icon name="download" size="sm" />
              Download the document
            </a>
          </div>
        ) : (
          <object
            data={`${media.publicUrl}#view=FitH&toolbar=1`}
            type="application/pdf"
            className="h-[75vh] min-h-[480px] w-full bg-surface-sunken"
            aria-label={label}
            onError={() => setFailed(true)}
          >
            {/* Shown when no PDF viewer is available — common on mobile. */}
            <div className="p-10 text-center">
              <Icon name="description" size="xl" className="text-ink-soft" />
              <p className="mt-4 text-ink-muted text-pretty">
                This document can be opened in your device&rsquo;s reader.
              </p>
              <a href={media.publicUrl} download className="btn-primary mt-6">
                <Icon name="download" size="sm" />
                Open the document
              </a>
            </div>
          </object>
        )}
      </div>
    </figure>
  );
}
