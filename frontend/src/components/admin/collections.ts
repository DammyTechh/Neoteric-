/**
 * The content collections, described as data.
 *
 * Six collections behind the same six endpoints, differing only in their
 * fields. Describing them rather than writing six near-identical pages means a
 * new field is one line here, and the list, the editor, the validation
 * mapping and the reordering stay in step by construction.
 */

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'image'
  | 'boolean'
  | 'select'
  | 'list'
  | 'colour'
  | 'icon';

export interface FieldSpec {
  /** The property name, matching the API exactly. */
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Full width in the two-column editor grid. */
  wide?: boolean;
  /** Paired id field written alongside an image URL. */
  idField?: string;
}

export interface CollectionSpec {
  /** URL segment under `/admin/content/`. */
  key: string;
  /** API path under `/admin`. */
  path: string;
  singular: string;
  plural: string;
  /**
   * The noun used when counting rows.
   *
   * Usually `plural` reads correctly ("13 practice areas"), but a collective
   * noun does not — "11 team" — so those name their own.
   */
  countNoun?: string;
  description: string;
  icon: string;
  /** The property shown as the row's heading. */
  titleField: string;
  /** The property shown beneath it. */
  subtitleField?: string;
  /** Rendered as a thumbnail in the list. */
  imageField?: string;
  /** The flag that decides whether the public site shows the record. */
  activeField?: 'isActive' | 'isPublished';
  fields: FieldSpec[];
}

const SORT_FIELD: FieldSpec = {
  name: 'sortOrder',
  label: 'Position',
  kind: 'number',
  hint: 'Lower numbers come first on the website.',
};

export const COLLECTIONS: CollectionSpec[] = [
  {
    key: 'practice-areas',
    path: '/admin/practice-areas',
    singular: 'Practice area',
    plural: 'Practice areas',
    description: 'The areas of law the firm practises, shown on the homepage slider.',
    icon: 'gavel',
    titleField: 'name',
    subtitleField: 'summary',
    imageField: 'imageUrl',
    activeField: 'isActive',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true, maxLength: 160 },
      {
        name: 'slug',
        label: 'Web address',
        kind: 'text',
        hint: 'Left blank, this is generated from the name.',
      },
      {
        name: 'summary',
        label: 'Summary',
        kind: 'textarea',
        maxLength: 300,
        wide: true,
        hint: 'One sentence. This is what appears on the homepage card.',
      },
      {
        name: 'description',
        label: 'Full description',
        kind: 'richtext',
        maxLength: 4000,
        wide: true,
      },
      { name: 'imageUrl', label: 'Image', kind: 'image', idField: 'imageId', wide: true },
      {
        name: 'icon',
        label: 'Icon',
        kind: 'icon',
        hint: 'A Material Symbols name, such as balance or gavel.',
      },
      SORT_FIELD,
      { name: 'seoTitle', label: 'Search title', kind: 'text', maxLength: 200 },
      {
        name: 'seoDescription',
        label: 'Search description',
        kind: 'textarea',
        maxLength: 400,
        wide: true,
      },
      {
        name: 'isActive',
        label: 'Show on the website',
        kind: 'boolean',
        wide: true,
      },
    ],
  },

  {
    key: 'industries',
    path: '/admin/industries',
    singular: 'Industry',
    plural: 'Industries',
    description: 'The sectors the firm serves. These are the slides in the hero carousel.',
    icon: 'apartment',
    titleField: 'name',
    subtitleField: 'description',
    imageField: 'imageUrl',
    activeField: 'isActive',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true, maxLength: 160 },
      { name: 'slug', label: 'Web address', kind: 'text' },
      {
        name: 'description',
        label: 'Description',
        kind: 'richtext',
        maxLength: 4000,
        wide: true,
      },
      {
        name: 'imageUrl',
        label: 'Hero image',
        kind: 'image',
        idField: 'imageId',
        wide: true,
        hint: 'This is the photograph behind the carousel slide — landscape, and as large as you have.',
      },
      { name: 'icon', label: 'Icon', kind: 'icon' },
      SORT_FIELD,
      { name: 'isActive', label: 'Show on the website', kind: 'boolean', wide: true },
    ],
  },

  {
    key: 'team',
    path: '/admin/team',
    singular: 'Team member',
    plural: 'Team',
    countNoun: 'team members',
    description: 'Everyone on the Our Team section, legal and operations.',
    icon: 'groups',
    titleField: 'fullName',
    subtitleField: 'roleTitle',
    imageField: 'imageUrl',
    activeField: 'isActive',
    fields: [
      { name: 'fullName', label: 'Full name', kind: 'text', required: true, maxLength: 160 },
      { name: 'roleTitle', label: 'Role', kind: 'text', required: true, maxLength: 160 },
      {
        name: 'teamGroup',
        label: 'Group',
        kind: 'select',
        options: [
          { value: 'legal', label: 'Legal practitioners' },
          { value: 'non_legal', label: 'Business & operations' },
        ],
      },
      { name: 'slug', label: 'Web address', kind: 'text' },
      {
        name: 'imageUrl',
        label: 'Photograph',
        kind: 'image',
        idField: 'imageId',
        wide: true,
        hint: 'A portrait, at least 800 pixels on the short edge. The cards crop to 3 by 4.',
      },
      { name: 'bio', label: 'Biography', kind: 'richtext', maxLength: 4000, wide: true },
      {
        name: 'qualifications',
        label: 'Qualifications',
        kind: 'list',
        wide: true,
        placeholder: 'LL.B, B.L, LL.M',
        hint: 'Comma separated.',
      },
      { name: 'email', label: 'Email', kind: 'text' },
      { name: 'phone', label: 'Phone', kind: 'text', maxLength: 40 },
      { name: 'linkedinUrl', label: 'LinkedIn', kind: 'text' },
      { name: 'twitterUrl', label: 'X / Twitter', kind: 'text' },
      SORT_FIELD,
      { name: 'isActive', label: 'Show on the website', kind: 'boolean', wide: true },
    ],
  },

  {
    key: 'testimonials',
    path: '/admin/testimonials',
    singular: 'Testimonial',
    plural: 'Testimonials',
    description: 'What clients say, shown in the quotes section.',
    icon: 'format_quote',
    titleField: 'authorName',
    subtitleField: 'quote',
    imageField: 'authorImageUrl',
    activeField: 'isPublished',
    fields: [
      {
        name: 'quote',
        label: 'The quote',
        kind: 'textarea',
        required: true,
        maxLength: 2000,
        wide: true,
      },
      { name: 'authorName', label: 'Who said it', kind: 'text', required: true, maxLength: 160 },
      { name: 'authorRole', label: 'Their role', kind: 'text', maxLength: 160 },
      { name: 'authorCompany', label: 'Their company', kind: 'text', maxLength: 160 },
      {
        name: 'rating',
        label: 'Rating',
        kind: 'select',
        options: [
          { value: '', label: 'No rating' },
          { value: '5', label: '5' },
          { value: '4', label: '4' },
          { value: '3', label: '3' },
          { value: '2', label: '2' },
          { value: '1', label: '1' },
        ],
      },
      {
        name: 'authorImageUrl',
        label: 'Photograph',
        kind: 'image',
        idField: 'authorImageId',
        wide: true,
      },
      SORT_FIELD,
      { name: 'isPublished', label: 'Show on the website', kind: 'boolean', wide: true },
    ],
  },

  {
    key: 'achievements',
    path: '/admin/achievements',
    singular: 'Achievement',
    plural: 'Achievements',
    description: 'The figures in the achievements band on the homepage.',
    icon: 'trending_up',
    titleField: 'label',
    subtitleField: 'description',
    activeField: 'isActive',
    fields: [
      { name: 'label', label: 'Label', kind: 'text', required: true, maxLength: 120 },
      {
        name: 'value',
        label: 'Figure',
        kind: 'text',
        required: true,
        maxLength: 40,
        hint: 'Just the number, such as 500.',
      },
      {
        name: 'suffix',
        label: 'Suffix',
        kind: 'text',
        maxLength: 20,
        hint: 'What follows the number, such as + or %.',
      },
      { name: 'description', label: 'Description', kind: 'textarea', maxLength: 400, wide: true },
      { name: 'icon', label: 'Icon', kind: 'icon' },
      SORT_FIELD,
      { name: 'isActive', label: 'Show on the website', kind: 'boolean', wide: true },
    ],
  },

  {
    key: 'categories',
    path: '/admin/categories',
    singular: 'Category',
    plural: 'Categories',
    description: 'How publications are grouped on the News & Publications page.',
    icon: 'sell',
    titleField: 'name',
    subtitleField: 'description',
    activeField: 'isActive',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true, maxLength: 120 },
      { name: 'slug', label: 'Web address', kind: 'text' },
      { name: 'description', label: 'Description', kind: 'textarea', maxLength: 500, wide: true },
      {
        name: 'colour',
        label: 'Colour',
        kind: 'colour',
        hint: 'Used for the category chip. Leave blank for the brand teal.',
      },
      SORT_FIELD,
      { name: 'isActive', label: 'Show on the website', kind: 'boolean', wide: true },
    ],
  },
];

export function findCollection(key: string): CollectionSpec | undefined {
  return COLLECTIONS.find((collection) => collection.key === key);
}
