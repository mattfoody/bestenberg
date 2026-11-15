import { getPattern, walk, type Doc, type Node } from '@bestenberg/schema';

/**
 * Demo site (PLAN.md M9): a few pages for a fictional bakery, built from the
 * section library, so a new install has something real to look at and edit.
 * Generated into wp/plugin/demo/pages.json and imported by Bestenberg\Demo\Importer.
 */

/** Stand-in for the plugin's demo folder; the importer swaps in the site's real URL. */
export const DEMO_IMAGE_BASE = 'https://demo.bestenberg.invalid/';

export interface DemoPage {
  slug: string;
  title: string;
  /** Becomes the site's front page (when the site does not have one yet). */
  front?: boolean;
  doc: Doc;
}

interface Fill {
  /** Replaces headings, paragraphs, list items, quotes and button labels, in page order. */
  texts: string[];
  /** Button targets, in page order. */
  links?: string[];
  images?: Array<{ file: string; alt: string }>;
  /** Client mode: the group whose items can be added, reordered and removed (first grid). */
  openGrid?: boolean;
}

/** One library section with the demo's wording, links and pictures filled in. */
function section(patternId: string, fill: Fill): Node[] {
  const pattern = getPattern(patternId);
  if (!pattern) throw new Error(`Unknown pattern ${patternId}`);
  const nodes = pattern.build();
  const texts = [...fill.texts];
  const links = [...(fill.links ?? [])];
  const images = [...(fill.images ?? [])];
  let grids = 0;
  walk(nodes, (node) => {
    const props = node.props ?? {};
    if (typeof props.citation === 'string' && texts.length > 0) props.citation = texts.shift();
    if (typeof props.text === 'string' && texts.length > 0) props.text = texts.shift();
    if (node.type === 'button' && links.length > 0) props.href = links.shift();
    if (node.type === 'image' && images.length > 0) {
      const image = images.shift()!;
      props.src = `${DEMO_IMAGE_BASE}${image.file}`;
      props.alt = image.alt;
    }
    if (fill.openGrid && node.type === 'grid' && grids++ === 0) node.locked = 'none';
  });
  if (texts.length > 0 || links.length > 0 || images.length > 0) {
    throw new Error(`Demo content does not fit pattern ${patternId}`);
  }
  return nodes;
}

function page(slug: string, title: string, sections: Node[][], front = false): DemoPage {
  const root = sections.flat();
  // Stable ids so the generated file does not change between runs.
  let count = 0;
  walk(root, (node) => {
    node.id = `demo-${slug}-${String(++count).padStart(4, '0')}`;
  });
  return {
    slug,
    title,
    ...(front ? { front } : {}),
    doc: { schemaVersion: 1, kind: 'page', meta: { title, slug }, root },
  };
}

const LOAVES = { file: 'loaves.svg', alt: 'Three loaves of bread on a shelf' };
const OVEN = { file: 'oven.svg', alt: 'A brick oven with a loaf inside' };

export const DEMO_PAGES: readonly DemoPage[] = [
  page(
    'home',
    'Morning Oven',
    [
      section('hero-split', {
        texts: [
          'Bread worth waking up for',
          'Sourdough, rye and seeded loaves, baked every morning at five in a wood-fired oven and gone by noon.',
          'See the bread box',
        ],
        links: ['/bread-box/'],
        images: [LOAVES],
      }),
      section('features-grid', {
        texts: [
          'Three things we never rush',
          'Slow dough',
          'Every loaf rests for 24 hours. That is where the flavour and the crust come from.',
          'Local grain',
          'Flour from two mills within forty kilometres, stone-ground the week we bake with it.',
          'Baked today',
          'Nothing is frozen or kept overnight. What is left at closing goes to the food bank.',
        ],
        openGrid: true,
      }),
      section('testimonials', {
        texts: [
          'What the neighbours say',
          'Ana, Saturday regular',
          'The rye lasts a week on my counter. It never gets the chance.',
          'Marko, café owner',
          'We switched our toast to their sourdough and people started asking where it is from.',
          'Iva, bread box subscriber',
          'Friday pickup is the best part of my week. The kids fight over the crust.',
        ],
        openGrid: true,
      }),
      section('cta-banner', {
        texts: [
          'Fresh bread every Friday',
          'Reserve your loaves once and pick them up warm. Pause or cancel any time.',
          'Choose a bread box',
        ],
        links: ['/bread-box/'],
      }),
    ],
    true,
  ),
  page('about', 'About', [
    section('content-image-text', {
      texts: [
        'One oven, four bakers',
        'Morning Oven started in 2019 with a second-hand brick oven and a queue that did not fit on the pavement. We still bake the same six breads.',
        'Wood-fired, every day except Sunday',
        'Sourdough starter older than the bakery',
        'Open from six until the shelves are empty',
      ],
      images: [OVEN],
    }),
    section('content-text', {
      texts: [
        'Why so few breads',
        'A short list lets us get each one right. The sourdough, the rye and the seeded loaf are always there; three more change with the season.',
        'If you miss one that is gone, tell us at the counter. Favourites tend to come back.',
      ],
    }),
  ]),
  page('bread-box', 'Bread box', [
    section('pricing-three', {
      texts: [
        'A standing order for good bread',
        'Small',
        '€9 a week',
        'One loaf of your choice',
        'Friday pickup',
        'Choose Small',
        'Family',
        '€24 a week',
        'Three loaves',
        'One seasonal bread',
        'Friday or Saturday pickup',
        'Choose Family',
        'Café',
        '€79 a week',
        'Ten loaves, sliced if you like',
        'Delivery before seven',
        'Invoice once a month',
        'Choose Café',
      ],
      links: ['/contact/', '/contact/', '/contact/'],
      openGrid: true,
    }),
    section('cta-banner', {
      texts: [
        'Not sure which one?',
        'Come by on a Saturday and taste all six. The first loaf is on us.',
        'Find the bakery',
      ],
      links: ['/contact/'],
    }),
  ]),
  page('contact', 'Contact', [
    section('content-text', {
      texts: [
        'Come by',
        'Morning Oven, 12 Mill Lane. Monday to Saturday from six in the morning until the bread is gone, usually around noon.',
        'For bread boxes and café orders write to <a href="mailto:hello@morningoven.example">hello@morningoven.example</a> or call <a href="tel:+15550100">555 0100</a>.',
      ],
    }),
  ]),
];
