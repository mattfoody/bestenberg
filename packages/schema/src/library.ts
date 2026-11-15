import { createId, type Node } from './document';
import type { ResponsiveStyle, Style } from './style';

/**
 * The section library: ready-made page sections expressed as schema nodes
 * (PLAN.md §5). WP-agnostic; the editor inserts them and the AI can use them
 * as examples. Every pattern is built fresh so ids are unique per insert.
 */

export const PATTERN_CATEGORIES = [
  'hero',
  'features',
  'content',
  'social-proof',
  'pricing',
  'cta',
] as const;
export type PatternCategory = (typeof PATTERN_CATEGORIES)[number];

export const PATTERN_CATEGORY_LABELS: Record<PatternCategory, string> = {
  hero: 'Hero',
  features: 'Features',
  content: 'Content',
  'social-proof': 'Testimonials',
  pricing: 'Pricing',
  cta: 'Call to action',
};

export interface PatternDef {
  id: string;
  label: string;
  category: PatternCategory;
  description: string;
  /** New nodes for one insert (top-level sections). */
  build: () => Node[];
}

type StyleInput = Style | ResponsiveStyle;

function responsive(style: StyleInput): ResponsiveStyle {
  return 'base' in style ? (style as ResponsiveStyle) : { base: style as Style };
}

/** Node builder: `n('heading', { text: 'Hi', level: 2 }, { color: 'color.primary' })`. */
function n(
  type: string,
  props?: Record<string, unknown> | null,
  style?: StyleInput | null,
  children?: Node[],
): Node {
  const node: Node = { id: createId(), type };
  if (props) node.props = props;
  if (style) node.style = responsive(style);
  if (children) node.children = children;
  return node;
}

const heading = (text: string, level: number, style?: StyleInput) =>
  n('heading', { text, level }, style);
const text = (content: string, style?: StyleInput) => n('text', { text: content }, style);
const buttons = (items: Array<[label: string, variant?: string]>, style?: StyleInput) =>
  n(
    'button-group',
    {},
    style,
    items.map(([label, variant]) =>
      n('button', { text: label, href: '#', ...(variant ? { variant } : {}) }),
    ),
  );
const section = (style: Style, children: Node[], width = 'container.lg') =>
  n('section', {}, { padding: { x: 'space.6', y: 'space.16' }, ...style }, [
    n('container', {}, { width } as Style, children),
  ]);

const featureCard = (title: string, body: string) =>
  n(
    'card',
    {},
    {
      padding: { x: 'space.6', y: 'space.6' },
      radius: 'radius.lg',
      background: 'color.surface',
      border: { width: 1, color: 'color.border' },
    },
    [heading(title, 3, { font: { size: 'fontSize.xl' } }), text(body, { color: 'color.muted' })],
  );

const priceCard = (name: string, price: string, items: string[], featured = false) =>
  n(
    'card',
    {},
    {
      padding: { x: 'space.8', y: 'space.8' },
      radius: 'radius.lg',
      background: 'color.surface',
      border: { width: featured ? 2 : 1, color: featured ? 'color.primary' : 'color.border' },
      ...(featured ? { shadow: 'shadow.lg' } : {}),
    },
    [
      heading(name, 3, { font: { size: 'fontSize.lg' }, color: 'color.muted' }),
      text(price, { font: { size: 'fontSize.4xl', weight: 'fontWeight.bold' } }),
      n(
        'list',
        { ordered: false },
        { margin: { top: 'space.4', bottom: 'space.6' } },
        items.map((item) => n('list-item', { text: item })),
      ),
      buttons([['Choose plan', featured ? 'primary' : 'secondary']]),
    ],
  );

const quoteCard = (words: string, who: string) =>
  n(
    'card',
    {},
    {
      padding: { x: 'space.6', y: 'space.6' },
      radius: 'radius.lg',
      background: 'color.surface',
      shadow: 'shadow.sm',
    },
    [n('quote', { citation: who }, null, [text(words)])],
  );

export const PATTERNS: readonly PatternDef[] = [
  {
    id: 'hero-centered',
    label: 'Centered hero',
    category: 'hero',
    description: 'Large headline, supporting line and two buttons, centered.',
    build: () => [
      section(
        { padding: { x: 'space.6', y: 'space.24' }, background: 'color.surface-alt' },
        [
          heading('Say what you do in one clear line', 1, {
            base: { font: { size: 'fontSize.4xl', align: 'center' } },
            desktop: { font: { size: 'fontSize.5xl' } },
          }),
          text('Add a sentence that explains who it is for and why it matters.', {
            font: { size: 'fontSize.lg', align: 'center' },
            color: 'color.muted',
            margin: { top: 'space.4' },
          }),
          buttons(
            [
              ['Get started', 'primary'],
              ['Learn more', 'secondary'],
            ],
            { layout: { justify: 'center', gap: 'space.3' }, margin: { top: 'space.8' } },
          ),
        ],
        'container.md',
      ),
    ],
  },
  {
    id: 'hero-split',
    label: 'Hero with image',
    category: 'hero',
    description: 'Headline and button beside an image; stacks on phones.',
    build: () => [
      section({}, [
        n(
          'grid',
          {},
          {
            base: { layout: { display: 'grid', columns: 1, gap: 'space.8', align: 'center' } },
            desktop: { layout: { columns: 2, gap: 'space.16' } },
          },
          [
            n('stack', {}, { layout: { display: 'stack', gap: 'space.4' } }, [
              heading('A headline that earns the next scroll', 1, {
                font: { size: 'fontSize.4xl' },
              }),
              text('Describe the main benefit in a sentence or two.', {
                font: { size: 'fontSize.lg' },
                color: 'color.muted',
              }),
              buttons([['Get started', 'primary']], { margin: { top: 'space.4' } }),
            ]),
            n('image', { src: '', alt: '' }, { radius: 'radius.lg', aspect: '4/3' }),
          ],
        ),
      ]),
    ],
  },
  {
    id: 'features-grid',
    label: 'Feature grid',
    category: 'features',
    description: 'Section title with three feature cards.',
    build: () => [
      section({}, [
        heading('Everything you need', 2, {
          font: { size: 'fontSize.3xl', align: 'center' },
          margin: { bottom: 'space.10' },
        }),
        n(
          'grid',
          {},
          {
            base: { layout: { display: 'grid', columns: 1, gap: 'space.6' } },
            tablet: { layout: { columns: 3 } },
          },
          [
            featureCard('First benefit', 'Explain it in plain words.'),
            featureCard('Second benefit', 'Say what changes for the customer.'),
            featureCard('Third benefit', 'Keep each one to a sentence or two.'),
          ],
        ),
      ]),
    ],
  },
  {
    id: 'content-image-text',
    label: 'Image and text',
    category: 'content',
    description: 'An image next to a heading, paragraph and list.',
    build: () => [
      section({}, [
        n(
          'grid',
          {},
          {
            base: { layout: { display: 'grid', columns: 1, gap: 'space.8', align: 'center' } },
            tablet: { layout: { columns: 2, gap: 'space.12' } },
          },
          [
            n('image', { src: '', alt: '' }, { radius: 'radius.lg', aspect: '4/3' }),
            n('stack', {}, { layout: { display: 'stack', gap: 'space.4' } }, [
              heading('Tell the story behind it', 2, { font: { size: 'fontSize.3xl' } }),
              text('Use this space for the detail that did not fit in the headline.'),
              n('list', { ordered: false }, null, [
                n('list-item', { text: 'A concrete point' }),
                n('list-item', { text: 'Another concrete point' }),
                n('list-item', { text: 'One more' }),
              ]),
            ]),
          ],
        ),
      ]),
    ],
  },
  {
    id: 'content-text',
    label: 'Text block',
    category: 'content',
    description: 'A narrow column of heading and paragraphs for longer reading.',
    build: () => [
      section(
        {},
        [
          heading('A heading for this part', 2, { font: { size: 'fontSize.3xl' } }),
          text('Write the first paragraph here.', { margin: { top: 'space.4' } }),
          text('And the second one here.', { margin: { top: 'space.4' } }),
        ],
        'container.sm',
      ),
    ],
  },
  {
    id: 'testimonials',
    label: 'Testimonials',
    category: 'social-proof',
    description: 'Three customer quotes in cards.',
    build: () => [
      section({ background: 'color.surface-alt' }, [
        heading('What customers say', 2, {
          font: { size: 'fontSize.3xl', align: 'center' },
          margin: { bottom: 'space.10' },
        }),
        n(
          'grid',
          {},
          {
            base: { layout: { display: 'grid', columns: 1, gap: 'space.6' } },
            tablet: { layout: { columns: 3 } },
          },
          [
            quoteCard('Replace this with a real quote from a customer.', 'Name, Company'),
            quoteCard('Short and specific quotes work best.', 'Name, Company'),
            quoteCard('Say what changed for them.', 'Name, Company'),
          ],
        ),
      ]),
    ],
  },
  {
    id: 'pricing-three',
    label: 'Pricing plans',
    category: 'pricing',
    description: 'Three plans side by side, the middle one highlighted.',
    build: () => [
      section({}, [
        heading('Simple pricing', 2, {
          font: { size: 'fontSize.3xl', align: 'center' },
          margin: { bottom: 'space.10' },
        }),
        n(
          'grid',
          {},
          {
            base: { layout: { display: 'grid', columns: 1, gap: 'space.6', align: 'start' } },
            tablet: { layout: { columns: 3 } },
          },
          [
            priceCard('Starter', '€9', ['One site', 'Email support']),
            priceCard('Pro', '€29', ['Five sites', 'Priority support', 'All features'], true),
            priceCard('Agency', '€79', ['Unlimited sites', 'Priority support', 'Client mode']),
          ],
        ),
      ]),
    ],
  },
  {
    id: 'cta-banner',
    label: 'Call to action',
    category: 'cta',
    description: 'A coloured band with one line and one button.',
    build: () => [
      section(
        { background: 'color.primary', color: 'color.on-primary' },
        [
          heading('Ready to start?', 2, { font: { size: 'fontSize.3xl', align: 'center' } }),
          text('One sentence that removes the last doubt.', {
            font: { align: 'center' },
            margin: { top: 'space.3' },
          }),
          buttons([['Get started', 'secondary']], {
            layout: { justify: 'center' },
            margin: { top: 'space.6' },
          }),
        ],
        'container.md',
      ),
    ],
  },
];

export function getPattern(id: string): PatternDef | undefined {
  return PATTERNS.find((pattern) => pattern.id === id);
}
