/**
 * Formatting helpers.
 *
 * Dates render in `en-NG` and Lagos time: the firm, its clients and its
 * readers are in Nigeria, so a publication dated "20 October 2026" should not
 * shift a day because the server happens to run in UTC.
 */

const LAGOS = 'Africa/Lagos';

export function formatDate(
  value: string | null | undefined,
  style: 'long' | 'medium' | 'short' = 'medium',
): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: LAGOS,
    ...(style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'medium'
        ? { day: 'numeric', month: 'short', year: 'numeric' }
        : { day: '2-digit', month: '2-digit', year: '2-digit' }),
  };

  return new Intl.DateTimeFormat('en-NG', options).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-NG', {
    timeZone: LAGOS,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** "3 days ago". Falls back to an absolute date beyond a month. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);

  const formatter = new Intl.RelativeTimeFormat('en-NG', { numeric: 'auto' });

  if (absolute < 60) return formatter.format(Math.round(seconds), 'second');
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (absolute < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour');
  if (absolute < 2_592_000) return formatter.format(Math.round(seconds / 86_400), 'day');

  return formatDate(value);
}

/** Thousands separators, for view counts and the like. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-NG').format(value);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Turns `in_review` into `In review` for display. */
export function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
