'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/Shell';
import {
  Button,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Panel,
  Pill,
  Spinner,
  Textarea,
  useToast,
} from '@/components/admin/ui';
import { ImageField } from '@/components/admin/MediaPicker';
import { Icon } from '@/components/ui/Icon';
import { useApi } from '@/lib/auth';
import { humanise } from '@/lib/format';
import { cn } from '@/lib/cn';

interface SiteSetting {
  key: string;
  value: unknown;
  valueType: 'string' | 'text' | 'number' | 'boolean' | 'json' | 'image' | 'url' | 'email';
  groupName: string;
  label: string;
  description: string | null;
  isPublic: boolean;
  sortOrder: number;
}

/** What each group is for, in the firm's own terms. */
const GROUP_BLURBS: Record<string, string> = {
  site: 'The name, address and logo used across every page.',
  hero: 'The headline and button on the opening screen.',
  about: 'The Who We Are section — its heading, its four paragraphs and its photographs.',
  vision: 'The vision statement, shown on the Vision & Mission cards.',
  mission: 'The mission statement, shown beside the vision.',
  contact: 'The office address, telephone and email in the footer and contact section.',
  social: 'Links to the firm’s profiles. Leave one blank to hide its icon.',
  seo: 'How the site describes itself to search engines and AI assistants.',
};

/**
 * Group headings.
 *
 * Derived from the key otherwise, which turns `seo` into "Seo" — the one
 * place a general-purpose humaniser cannot guess an acronym.
 */
const GROUP_LABELS: Record<string, string> = { seo: 'SEO' };

const GROUP_ICONS: Record<string, string> = {
  site: 'public',
  hero: 'wallpaper',
  about: 'info',
  vision: 'visibility',
  mission: 'flag',
  contact: 'contact_mail',
  social: 'share',
  seo: 'travel_explore',
};

/**
 * A setting's value as text for the form.
 *
 * JSON settings — `about.body` is an array of paragraphs, `about.images` an
 * array of URLs — are edited as formatted JSON rather than through a bespoke
 * repeater per key. It is honest about what is stored, and it means a new JSON
 * setting needs no new UI.
 */
function toText(setting: SiteSetting): string {
  if (setting.value == null) return '';
  if (setting.valueType === 'json') return JSON.stringify(setting.value, null, 2);
  return String(setting.value);
}

/** Turns the edited text back into the value the API expects. */
function fromText(setting: SiteSetting, text: string): unknown {
  switch (setting.valueType) {
    case 'number':
      return text === '' ? null : Number(text);
    case 'boolean':
      return text === 'true';
    case 'json':
      // Already validated before this is called.
      return text.trim() === '' ? null : JSON.parse(text);
    default:
      return text === '' ? null : text;
  }
}

export default function SettingsPage() {
  const api = useApi();
  const { notify } = useToast();

  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api.get<SiteSetting[]>('/admin/settings');
      setSettings(result);
      setDrafts(Object.fromEntries(result.map((setting) => [setting.key, toText(setting)])));
      setOpenGroup((current) => current ?? result[0]?.groupName ?? null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, SiteSetting[]>();

    for (const setting of [...settings].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const existing = map.get(setting.groupName) ?? [];
      existing.push(setting);
      map.set(setting.groupName, existing);
    }

    return Array.from(map.entries());
  }, [settings]);

  /** Which keys the editor has actually touched. */
  const changed = useMemo(
    () => settings.filter((setting) => drafts[setting.key] !== toText(setting)),
    [settings, drafts],
  );

  /** JSON fields that no longer parse — saving these would 500. */
  const invalid = useMemo(
    () =>
      changed
        .filter((setting) => setting.valueType === 'json')
        .filter((setting) => {
          const text = drafts[setting.key]?.trim();
          if (!text) return false;
          try {
            JSON.parse(text);
            return false;
          } catch {
            return true;
          }
        })
        .map((setting) => setting.key),
    [changed, drafts],
  );

  async function save() {
    if (changed.length === 0 || invalid.length > 0) return;
    setSaving(true);

    try {
      await api.put('/admin/settings', {
        settings: changed.map((setting) => ({
          key: setting.key,
          value: fromText(setting, drafts[setting.key] ?? ''),
        })),
      });

      notify(`Saved ${changed.length} ${changed.length === 1 ? 'setting' : 'settings'}`);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const set = (key: string, value: string) =>
    setDrafts((current) => ({ ...current, [key]: value }));

  return (
    <AdminShell
      title="Site settings"
      description="The words and pictures on the public pages, without touching any code."
      actions={
        <Button
          variant="secondary"
          icon="save"
          busy={saving}
          disabled={changed.length === 0 || invalid.length > 0}
          onClick={() => void save()}
        >
          {changed.length > 0 ? `Save ${changed.length}` : 'Saved'}
        </Button>
      }
    >
      {loading ? (
        <Panel padded={false}>
          <Spinner />
        </Panel>
      ) : error ? (
        <Panel padded={false}>
          <ErrorState message={error} onRetry={() => void load()} />
        </Panel>
      ) : (
        <div className="space-y-4">
          {invalid.length > 0 && (
            <div className="flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4" role="alert">
              <Icon name="error" className="shrink-0 text-red-600" />
              <p className="text-small text-red-900">
                {invalid.length === 1 ? 'One field is' : `${invalid.length} fields are`} not
                valid JSON — <span className="font-mono">{invalid.join(', ')}</span>. Fix
                those before saving.
              </p>
            </div>
          )}

          {groups.map(([group, groupSettings]) => {
            const expanded = openGroup === group;
            const groupChanges = groupSettings.filter(
              (setting) => drafts[setting.key] !== toText(setting),
            ).length;

            return (
              <section
                key={group}
                className="overflow-hidden rounded-panel border border-surface-line bg-surface shadow-float"
              >
                <button
                  type="button"
                  onClick={() => setOpenGroup(expanded ? null : group)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-sunken/60"
                >
                  <span
                    className={cn(
                      'grid h-11 w-11 shrink-0 place-items-center rounded-card transition-colors',
                      expanded ? 'bg-primary text-white' : 'bg-primary-50 text-primary',
                    )}
                  >
                    <Icon name={GROUP_ICONS[group] ?? 'tune'} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-base font-semibold text-ink">
                        {GROUP_LABELS[group] ?? humanise(group)}
                      </span>
                      {groupChanges > 0 && (
                        <Pill tone="bronze">
                          {groupChanges} unsaved
                        </Pill>
                      )}
                    </span>
                    <span className="mt-0.5 block text-small text-ink-muted">
                      {GROUP_BLURBS[group] ??
                        `${groupSettings.length} settings in this group.`}
                    </span>
                  </span>

                  <Icon
                    name="expand_more"
                    className={cn(
                      'shrink-0 text-ink-muted transition-transform duration-300',
                      expanded && 'rotate-180',
                    )}
                  />
                </button>

                {expanded && (
                  <div className="grid gap-6 border-t border-surface-line px-6 py-6 lg:grid-cols-2">
                    {groupSettings.map((setting) => {
                      const text = drafts[setting.key] ?? '';
                      const isLong =
                        setting.valueType === 'text' || setting.valueType === 'json';
                      const badJson = invalid.includes(setting.key);

                      return (
                        <div
                          key={setting.key}
                          className={isLong ? 'lg:col-span-2' : undefined}
                        >
                          {setting.valueType === 'image' ? (
                            <ImageField
                              label={setting.label}
                              hint={setting.description ?? undefined}
                              url={text || null}
                              onChange={({ url }) => set(setting.key, url ?? '')}
                            />
                          ) : setting.valueType === 'boolean' ? (
                            <div className="rounded-card border border-surface-line bg-surface-sunken p-4">
                              <Checkbox
                                label={setting.label}
                                description={setting.description ?? undefined}
                                checked={text === 'true'}
                                onChange={(next) => set(setting.key, String(next))}
                              />
                            </div>
                          ) : (
                            <Field
                              label={setting.label}
                              hint={
                                badJson
                                  ? undefined
                                  : (setting.description ?? undefined)
                              }
                              error={badJson ? 'This is not valid JSON.' : undefined}
                            >
                              {setting.valueType === 'json' ? (
                                <Textarea
                                  rows={10}
                                  value={text}
                                  onChange={(event) => set(setting.key, event.target.value)}
                                  className="font-mono text-small"
                                  spellCheck={false}
                                />
                              ) : setting.valueType === 'text' ? (
                                <Textarea
                                  rows={4}
                                  value={text}
                                  onChange={(event) => set(setting.key, event.target.value)}
                                />
                              ) : (
                                <Input
                                  type={
                                    setting.valueType === 'number'
                                      ? 'number'
                                      : setting.valueType === 'email'
                                        ? 'email'
                                        : 'text'
                                  }
                                  mono={
                                    setting.valueType === 'url' ||
                                    setting.valueType === 'number'
                                  }
                                  value={text}
                                  onChange={(event) => set(setting.key, event.target.value)}
                                />
                              )}
                            </Field>
                          )}

                          <p className="mt-2 font-mono text-caption text-ink-soft">
                            {setting.key}
                            {!setting.isPublic && ' · internal'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          <div className="flex items-start gap-3 rounded-card border border-surface-line bg-surface-sunken p-4">
            <Icon name="schedule" className="shrink-0 text-ink-muted" />
            <p className="text-small text-ink-muted">
              Saved changes reach the public pages within a minute — the site caches each
              page and rebuilds it on the next visit after that.
            </p>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
