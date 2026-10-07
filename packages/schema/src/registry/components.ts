import { z } from 'zod/v4';
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
import type { ComponentDef } from './types';

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

export const section = defineComponent({
  type: 'section',
  label: 'Section',
  icon: 'layout',
  category: 'layout',
  block: 'bestenberg/section',
  props: z.strictObject({
    tag: z.enum(['section', 'div', 'header', 'footer', 'aside', 'main']).optional(),
    anchor: z
      .string()
      .regex(/^[A-Za-z][\w-]*$/)
      .optional(),
  }),
  styles: BOX_STYLES,
  allowedChildren: 'any',
  controls: [
    {
      id: 'tag',
      group: 'content',
      label: 'HTML tag',
      kind: 'select',
      path: 'props.tag',
      options: ['section', 'div', 'header', 'footer', 'aside', 'main'].map((v) => ({
        value: v,
        label: `<${v}>`,
      })),
    },
    { id: 'anchor', group: 'content', label: 'Anchor', kind: 'text', path: 'props.anchor' },
    ...boxControls({}),
  ],
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
  ai: {
    description:
      'Equal-width columns. Set columns per breakpoint, mobile first (e.g. base 1, desktop 3).',
  },
});

export const heading = defineComponent({
  type: 'heading',
  label: 'Heading',
  icon: 'heading',
  category: 'content',
  block: 'core/heading',
  props: z.strictObject({
    text: z.string(),
    level: z.literal([1, 2, 3, 4, 5, 6]),
  }),
  styles: ['font', 'color', 'margin'],
  allowedChildren: 'none',
  controls: [
    { id: 'text', group: 'content', label: 'Text', kind: 'richtext', path: 'props.text' },
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
  props: z.strictObject({ text: z.string() }),
  styles: ['font', 'color', 'margin'],
  allowedChildren: 'none',
  controls: [
    { id: 'text', group: 'content', label: 'Text', kind: 'richtext', path: 'props.text' },
    ...typographyControls(),
    ...colorControls({ background: false }),
    ...marginControls(),
    ...visibilityControls(),
  ],
  ai: { description: 'Paragraph of body text. Inline bold, italic and links only.' },
});

export const button = defineComponent({
  type: 'button',
  label: 'Button',
  icon: 'button',
  category: 'content',
  block: 'core/button',
  props: z.strictObject({
    text: z.string().min(1),
    href: z.string().optional(),
    target: z.enum(['_self', '_blank']).optional(),
    variant: z.enum(['primary', 'secondary', 'ghost']).optional(),
  }),
  styles: ['font', 'color', 'background', 'padding', 'margin', 'radius', 'shadow', 'border'],
  allowedChildren: 'none',
  controls: [
    { id: 'text', group: 'content', label: 'Label', kind: 'text', path: 'props.text' },
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
    src: z.string().min(1),
    alt: z.string(),
    mediaId: z.number().int().positive().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
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

/** The v1 component set registered so far (M1: layout + basic content). */
export const V1_COMPONENTS: ComponentDef[] = [
  section,
  container,
  stack,
  row,
  grid,
  heading,
  text,
  button,
  image,
];

export function createDefaultRegistry(): Registry {
  return createRegistry(V1_COMPONENTS);
}

/** Shared default registry. */
export const defaultRegistry: Registry = createDefaultRegistry();
