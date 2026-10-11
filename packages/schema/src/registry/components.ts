import { z } from 'zod/v4';
import { isSafeRichText, isSafeUrl } from '../rich-text';
import type { StyleKey } from '../style';
import {
  colorControls,
  effectsControls,
  layoutControls,
  marginControls,
  spacingControls,
  typographyControls,
  visibilityControls,
  widthControls,
} from './controls';
import { createRegistry, defineComponent, type Registry } from './registry';
import type { ComponentDef, ControlDef } from './types';

/** Inline HTML limited to strong, em, a, br and span.bb-* (canonical form). */
export const RichTextSchema = z
  .string()
  .refine(isSafeRichText, 'only strong, em, a, br and span.bb-* are allowed; escape & < >');

/** http(s), mailto, tel or relative URL. */
export const UrlSchema = z.string().min(1).refine(isSafeUrl, 'unsafe or invalid URL');

const BOX_STYLES: StyleKey[] = [
  'layout',
  'padding',
  'margin',
  'width',
  'background',
  'color',
  'radius',
  'shadow',
  'border',
];

const boxControls = (layout: Parameters<typeof layoutControls>[0]) => [
  ...layoutControls(layout),
  ...widthControls(),
  ...spacingControls(),
  ...colorControls(),
  ...effectsControls(),
  ...visibilityControls(),
];

const tagControl = (tags: readonly string[]): ControlDef => ({
  id: 'tag',
  group: 'content',
  label: 'HTML tag',
  kind: 'select',
  path: 'props.tag',
  options: tags.map((value) => ({ value, label: `<${value}>` })),
});

const richTextControl = (label = 'Text'): ControlDef => ({
  id: 'text',
  group: 'content',
  label,
  kind: 'richtext',
  path: 'props.text',
});

const SECTION_TAGS = ['section', 'div', 'header', 'footer', 'aside', 'main'] as const;
const CARD_TAGS = ['div', 'article'] as const;

// ── Layout (rendered by Bestenberg) ─────────────────────────────────────────

export const section = defineComponent({
  type: 'section',
  label: 'Section',
  icon: 'layout',
  category: 'layout',
  block: 'bestenberg/section',
  props: z.strictObject({
    tag: z.enum(SECTION_TAGS).optional(),
    anchor: z
      .string()
      .regex(/^[A-Za-z][\w-]*$/)
      .optional(),
  }),
  styles: BOX_STYLES,
  allowedChildren: 'any',
  controls: [
    tagControl(SECTION_TAGS),
    { id: 'anchor', group: 'content', label: 'Anchor', kind: 'text', path: 'props.anchor' },
    ...boxControls({}),
  ],
  element: { tag: 'section', tags: SECTION_TAGS, classes: ['bb-section'] },
  ai: { description: 'Full-width page band. Top-level building block of a page.' },
});

export const container = defineComponent({
  type: 'container',
  label: 'Container',
  icon: 'container',
  category: 'layout',
  block: 'bestenberg/container',
  props: z.strictObject({}),
  styles: BOX_STYLES,
  allowedChildren: 'any',
  controls: boxControls({}),
  element: { tag: 'div', classes: ['bb-container'] },
  ai: { description: 'Constrains content to a container width, usually inside a section.' },
});

export const stack = defineComponent({
  type: 'stack',
  label: 'Stack',
  icon: 'stack',
  category: 'layout',
  block: 'bestenberg/stack',
  props: z.strictObject({}),
  styles: BOX_STYLES,
  allowedChildren: 'any',
  controls: boxControls({ display: false, columns: false }),
  element: { tag: 'div', classes: ['bb-stack', 'bb:flex', 'bb:flex-col'] },
  ai: { description: 'Vertical flow of children with a token gap.' },
});

export const row = defineComponent({
  type: 'row',
  label: 'Row',
  icon: 'row',
  category: 'layout',
  block: 'bestenberg/row',
  props: z.strictObject({}),
  styles: BOX_STYLES,
  allowedChildren: 'any',
  controls: boxControls({ display: false, columns: false }),
  element: { tag: 'div', classes: ['bb-row', 'bb:flex', 'bb:flex-row'] },
  ai: { description: 'Horizontal flow of children; wraps optionally.' },
});

export const grid = defineComponent({
  type: 'grid',
  label: 'Grid',
  icon: 'grid',
  category: 'layout',
  block: 'bestenberg/grid',
  props: z.strictObject({}),
  styles: BOX_STYLES,
  allowedChildren: 'any',
  controls: boxControls({ display: false, wrap: false }),
  element: { tag: 'div', classes: ['bb-grid', 'bb:grid'] },
  ai: {
    description:
      'Equal-width columns. Set columns per breakpoint, mobile first (e.g. base 1, desktop 3).',
  },
});

export const card = defineComponent({
  type: 'card',
  label: 'Card',
  icon: 'card',
  category: 'layout',
  block: 'bestenberg/card',
  props: z.strictObject({ tag: z.enum(CARD_TAGS).optional() }),
  styles: BOX_STYLES,
  allowedChildren: 'any',
  controls: [tagControl(CARD_TAGS), ...boxControls({})],
  element: { tag: 'div', tags: CARD_TAGS, classes: ['bb-card'] },
  ai: { description: 'Self-contained box (feature, testimonial, product teaser).' },
});

export const spacer = defineComponent({
  type: 'spacer',
  label: 'Spacer',
  icon: 'spacer',
  category: 'layout',
  block: 'bestenberg/spacer',
  props: z.strictObject({}),
  styles: ['height'],
  allowedChildren: 'none',
  controls: [
    {
      id: 'height',
      group: 'layout',
      label: 'Height',
      kind: 'token',
      token: 'space',
      path: 'style.height',
      responsive: true,
      quick: true,
    },
    ...visibilityControls(),
  ],
  element: { tag: 'div', classes: ['bb-spacer'], attributes: { 'aria-hidden': 'true' } },
  ai: { description: 'Empty vertical space. Prefer gap and padding; use sparingly.' },
});

// ── Content (stored as core blocks) ─────────────────────────────────────────

export const heading = defineComponent({
  type: 'heading',
  label: 'Heading',
  icon: 'heading',
  category: 'content',
  block: 'core/heading',
  props: z.strictObject({
    text: RichTextSchema,
    level: z.literal([1, 2, 3, 4, 5, 6]),
  }),
  styles: ['font', 'color', 'margin'],
  allowedChildren: 'none',
  controls: [
    richTextControl(),
    {
      id: 'level',
      group: 'content',
      label: 'Level',
      kind: 'segmented',
      path: 'props.level',
      options: [1, 2, 3, 4, 5, 6].map((level) => ({ value: level, label: `H${level}` })),
      quick: true,
    },
    ...typographyControls(),
    ...colorControls({ background: false }),
    ...marginControls(),
    ...visibilityControls(),
  ],
  ai: { description: 'Section or page heading. One level 1 heading per page.' },
});

export const text = defineComponent({
  type: 'text',
  label: 'Text',
  icon: 'text',
  category: 'content',
  block: 'core/paragraph',
  props: z.strictObject({ text: RichTextSchema }),
  styles: ['font', 'color', 'margin'],
  allowedChildren: 'none',
  controls: [
    richTextControl(),
    ...typographyControls(),
    ...colorControls({ background: false }),
    ...marginControls(),
    ...visibilityControls(),
  ],
  ai: { description: 'Paragraph of body text. Inline bold, italic and links only.' },
});

export const list = defineComponent({
  type: 'list',
  label: 'List',
  icon: 'list',
  category: 'content',
  block: 'core/list',
  props: z.strictObject({ ordered: z.boolean() }),
  styles: ['font', 'color', 'margin'],
  allowedChildren: ['list-item'],
  controls: [
    { id: 'ordered', group: 'content', label: 'Numbered', kind: 'toggle', path: 'props.ordered' },
    ...typographyControls(),
    ...colorControls({ background: false }),
    ...marginControls(),
    ...visibilityControls(),
  ],
  ai: { description: 'Bulleted or numbered list of list-item children.' },
});

export const listItem = defineComponent({
  type: 'list-item',
  label: 'List item',
  icon: 'list-item',
  category: 'content',
  block: 'core/list-item',
  props: z.strictObject({ text: RichTextSchema }),
  styles: [],
  allowedChildren: ['list'],
  allowedParents: ['list'],
  controls: [richTextControl()],
  ai: { description: 'One list entry. May contain a nested list.' },
});

export const buttonGroup = defineComponent({
  type: 'button-group',
  label: 'Buttons',
  icon: 'buttons',
  category: 'content',
  block: 'core/buttons',
  props: z.strictObject({}),
  styles: ['layout', 'margin'],
  allowedChildren: ['button'],
  controls: [
    ...layoutControls({ display: false, columns: false, wrap: false }),
    ...marginControls(),
    ...visibilityControls(),
  ],
  ai: { description: 'Row of buttons. Buttons must be inside a button group.' },
});

export const button = defineComponent({
  type: 'button',
  label: 'Button',
  icon: 'button',
  category: 'content',
  block: 'core/button',
  props: z.strictObject({
    text: RichTextSchema.min(1),
    href: UrlSchema.optional(),
    target: z.enum(['_self', '_blank']).optional(),
    variant: z.enum(['primary', 'secondary', 'ghost']).optional(),
  }),
  styles: ['font', 'color', 'background', 'padding', 'margin', 'radius', 'shadow', 'border'],
  allowedChildren: 'none',
  allowedParents: ['button-group'],
  controls: [
    richTextControl('Label'),
    { id: 'href', group: 'content', label: 'Link', kind: 'link', path: 'props.href', quick: true },
    {
      id: 'target',
      group: 'content',
      label: 'Open in new tab',
      kind: 'toggle',
      path: 'props.target',
    },
    {
      id: 'variant',
      group: 'content',
      label: 'Style',
      kind: 'segmented',
      path: 'props.variant',
      options: ['primary', 'secondary', 'ghost'].map((v) => ({
        value: v,
        label: v.charAt(0).toUpperCase() + v.slice(1),
      })),
    },
    ...typographyControls().filter((c) => c.id !== 'font.align'),
    ...colorControls(),
    ...spacingControls(),
    ...effectsControls(),
    ...visibilityControls(),
  ],
  ai: { description: 'Call to action link styled as a button.' },
});

export const image = defineComponent({
  type: 'image',
  label: 'Image',
  icon: 'image',
  category: 'media',
  block: 'core/image',
  props: z.strictObject({
    src: UrlSchema,
    alt: z.string(),
    mediaId: z.number().int().positive().optional(),
  }),
  styles: ['width', 'aspect', 'radius', 'shadow', 'border', 'margin'],
  allowedChildren: 'none',
  controls: [
    { id: 'src', group: 'content', label: 'Image', kind: 'media', path: 'props.src', quick: true },
    { id: 'alt', group: 'content', label: 'Alt text', kind: 'text', path: 'props.alt' },
    ...widthControls(),
    ...effectsControls({ aspect: true }),
    ...marginControls(),
    ...visibilityControls(),
  ],
  ai: { description: 'Image with required alt text (empty string if decorative).' },
});

export const divider = defineComponent({
  type: 'divider',
  label: 'Divider',
  icon: 'divider',
  category: 'content',
  block: 'core/separator',
  props: z.strictObject({}),
  styles: ['margin'],
  allowedChildren: 'none',
  controls: [...marginControls(), ...visibilityControls()],
  ai: { description: 'Horizontal rule between content.' },
});

export const quote = defineComponent({
  type: 'quote',
  label: 'Quote',
  icon: 'quote',
  category: 'content',
  block: 'core/quote',
  props: z.strictObject({ citation: RichTextSchema.min(1).optional() }),
  styles: ['font', 'color', 'margin', 'padding', 'border'],
  allowedChildren: ['text'],
  controls: [
    {
      id: 'citation',
      group: 'content',
      label: 'Citation',
      kind: 'richtext',
      path: 'props.citation',
    },
    ...typographyControls(),
    ...colorControls({ background: false }),
    ...spacingControls(),
    ...effectsControls().filter((c) => c.id.startsWith('border.')),
    ...visibilityControls(),
  ],
  ai: { description: 'Quotation made of text children, with an optional citation.' },
});

// ── Internal ────────────────────────────────────────────────────────────────

/**
 * A block Bestenberg does not understand, kept verbatim so nothing is lost
 * (SCHEMA.md §7). Read-only; may be moved or deleted. Never created by the AI.
 */
export const raw = defineComponent({
  type: 'raw',
  label: 'Unsupported block',
  icon: 'raw',
  category: 'content',
  block: '*',
  props: z.strictObject({ name: z.string().min(1), markup: z.string() }),
  styles: [],
  allowedChildren: 'none',
  controls: [],
  internal: true,
});

/** The v1 component set registered so far. */
export const V1_COMPONENTS: ComponentDef[] = [
  section,
  container,
  stack,
  row,
  grid,
  card,
  spacer,
  heading,
  text,
  list,
  listItem,
  buttonGroup,
  button,
  image,
  divider,
  quote,
  raw,
];

export function createDefaultRegistry(): Registry {
  return createRegistry(V1_COMPONENTS);
}

/** Shared default registry. */
export const defaultRegistry: Registry = createDefaultRegistry();
