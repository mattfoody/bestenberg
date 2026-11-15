import { describe, expect, it } from 'vitest';
import { PATTERNS, defaultRegistry, validateDoc, walk, type Node } from '@bestenberg/schema';
import {
  MAX_REPAIR_ROUNDS,
  buildSystemPrompt,
  buildUserPrompt,
  extractJson,
  generateSections,
  normalizeNodes,
  normalizeStyle,
  scriptedProvider,
  snapToken,
  stripIds,
} from './index';

const valid = (nodes: Node[]) =>
  validateDoc(
    { schemaVersion: 1, kind: 'page', meta: { title: 'T' }, root: nodes },
    { registry: defaultRegistry },
  );

const HERO = JSON.stringify({
  sections: [
    {
      type: 'section',
      style: { base: { padding: { x: 'space.6', y: 'space.20' }, background: 'color.primary' } },
      children: [
        {
          type: 'container',
          style: { base: { width: 'container.md' } },
          children: [
            { type: 'heading', props: { text: 'Fresh bread daily', level: 1 } },
            { type: 'text', props: { text: 'Baked at 5am.' } },
            {
              type: 'button-group',
              children: [{ type: 'button', props: { text: 'Order', href: '/order' } }],
            },
          ],
        },
      ],
    },
  ],
});

describe('snapToken', () => {
  it('keeps valid references and adds missing prefixes', () => {
    expect(snapToken('space', 'space.4')).toBe('space.4');
    expect(snapToken('color', 'primary')).toBe('color.primary');
    expect(snapToken('fontSize', '2XL')).toBe('fontSize.2xl');
    expect(snapToken('color', 'colors.primary')).toBe('color.primary');
  });

  it('snaps scale numbers and CSS lengths to the nearest token', () => {
    expect(snapToken('space', 'space.7')).toMatch(/^space\.(6|8)$/);
    expect(snapToken('space', '24px')).toBe('space.6');
    expect(snapToken('space', '1rem')).toBe('space.4');
    expect(snapToken('space', 400)).toBe('space.24');
    expect(snapToken('fontWeight', 700)).toBe('fontWeight.bold');
    expect(snapToken('fontWeight', '650')).toMatch(/^fontWeight\.(semibold|bold)$/);
    expect(snapToken('radius', '9999px')).toBe('radius.full');
  });

  it('snaps hex colours to the nearest token and maps common names', () => {
    expect(snapToken('color', '#1e40af')).toBe('color.primary');
    expect(snapToken('color', '#fff')).toMatch(/^color\.(surface|on-primary)$/);
    expect(snapToken('color', 'white')).toBe('color.surface');
  });

  it('returns undefined for values it cannot place', () => {
    expect(snapToken('color', 'sparkly')).toBeUndefined();
    expect(snapToken('space', 'auto')).toBeUndefined();
    expect(snapToken('shadow', '0 1px 2px #000')).toBeUndefined();
    expect(snapToken('space', null)).toBeUndefined();
  });
});

describe('normalizeStyle', () => {
  it('keeps only allowed keys with valid values', () => {
    expect(
      normalizeStyle(
        {
          padding: { top: '32px', left: 6 },
          color: '#16a34a',
          font: { size: '3xl', align: 'left', weight: 'bold' },
          position: 'absolute',
          background: 'color.primary',
        },
        ['padding', 'color', 'font'],
      ),
    ).toEqual({
      padding: { x: 'space.6', y: 'space.8' },
      color: 'color.success',
      font: { size: 'fontSize.3xl', align: 'start', weight: 'fontWeight.bold' },
    });
  });

  it('maps layout near-misses', () => {
    expect(
      normalizeStyle(
        { layout: { display: 'flex', columns: 7, justify: 'space-between', gap: '16px' } },
        ['layout'],
      ),
    ).toEqual({ layout: { display: 'row', columns: 6, justify: 'between', gap: 'space.4' } });
  });

  it('drops unsafe background images', () => {
    expect(
      normalizeStyle({ background: { image: { url: 'javascript:alert(1)' } } }, ['background']),
    ).toBeUndefined();
  });
});

describe('normalizeNodes', () => {
  it('assigns ids and produces a valid document', () => {
    const nodes = normalizeNodes(JSON.parse(HERO));
    const result = valid(nodes);
    expect(result.ok ? [] : result.issues).toEqual([]);
    const ids: string[] = [];
    walk(nodes, (node) => ids.push(node.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fixes loose buttons, flat styles, aliases and content outside sections', () => {
    const nodes = normalizeNodes([
      { type: 'h2', text: 'Title', style: { color: 'primary' } },
      { type: 'paragraph', props: { content: 'Body & more' } },
      { type: 'button', props: { label: 'Go', url: 'https://example.com' } },
      { type: 'button', props: { label: 'Bad', url: 'javascript:alert(1)' } },
      { type: 'list', props: { items: ['One', 'Two'] } },
    ]);
    const result = valid(nodes);
    expect(result.ok ? [] : result.issues).toEqual([]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.type).toBe('section');
    const inner = nodes[0]!.children![0]!.children!;
    expect(inner.map((node) => node.type)).toEqual(['heading', 'text', 'button-group', 'list']);
    expect(inner[0]).toMatchObject({
      props: { text: 'Title', level: 2 },
      style: { base: { color: 'color.primary' } },
    });
    expect(inner[1]!.props!.text).toBe('Body &amp; more');
    expect(inner[2]!.children!.map((button) => button.props!.href)).toEqual([
      'https://example.com',
      undefined,
    ]);
    expect(inner[3]!.children).toHaveLength(2);
  });

  it('sanitizes rich text', () => {
    const [section] = normalizeNodes([
      { type: 'text', props: { text: 'Hi <script>alert(1)</script><strong>there</strong>' } },
    ]);
    const text = section!.children![0]!.children![0]!.props!.text as string;
    expect(text).not.toContain('<script');
    expect(text).toContain('<strong>there</strong>');
  });

  it('leaves unknown components for validation to report', () => {
    const result = valid(normalizeNodes([{ type: 'section', children: [{ type: 'carousel' }] }]));
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.message).toContain('carousel');
  });

  it('round-trips every library pattern through stripIds', () => {
    for (const pattern of PATTERNS) {
      const built = pattern.build();
      const again = normalizeNodes({ sections: stripIds(built) });
      expect(stripIds(again)).toEqual(stripIds(built));
    }
  });
});

describe('extractJson', () => {
  it('reads plain, fenced and wrapped JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":[1,2]} Hope that helps.')).toEqual({ a: [1, 2] });
    expect(extractJson('no json here')).toBeUndefined();
  });
});

describe('prompts', () => {
  it('lists every public component and the tokens', () => {
    const system = buildSystemPrompt();
    for (const def of defaultRegistry.list()) {
      if (def.internal) expect(system).not.toContain(`- ${def.type}:`);
      else expect(system).toContain(`- ${def.type}:`);
    }
    expect(system).toContain('color.*: primary');
    expect(system).toContain('"sections"');
  });

  it('mentions the existing page and the screenshot', () => {
    const prompt = buildUserPrompt({
      request: 'Add pricing',
      existing: normalizeNodes(JSON.parse(HERO)),
      hasImage: true,
    });
    expect(prompt).toContain('Add pricing');
    expect(prompt).toContain('1. section: Fresh bread daily');
    expect(prompt).toContain('screenshot');
  });
});

describe('generateSections', () => {
  it('returns valid sections on the first call', async () => {
    const provider = scriptedProvider([HERO]);
    const result = await generateSections({ request: 'A bakery hero', provider });
    expect(result).toMatchObject({ ok: true, calls: 1, issues: [] });
    expect(result.nodes[0]!.type).toBe('section');
    expect(provider.requests[0]!.prompt).toContain('A bakery hero');
    expect(provider.requests[0]!.system).toContain('# Components');
  });

  it('feeds validation problems back and accepts the repaired answer', async () => {
    const broken = JSON.stringify({
      sections: [{ type: 'section', children: [{ type: 'carousel' }] }],
    });
    const rounds: number[] = [];
    const provider = scriptedProvider(['not json at all', broken, HERO]);
    const result = await generateSections({
      request: 'A bakery hero',
      provider,
      onRound: (round) => rounds.push(round),
    });
    expect(result).toMatchObject({ ok: true, calls: 3 });
    expect(rounds).toEqual([0, 1, 2]);
    expect(provider.requests[1]!.prompt).toContain('not valid JSON');
    expect(provider.requests[2]!.prompt).toContain('unknown component "carousel"');
    expect(provider.requests[2]!.prompt).toContain('A bakery hero');
  });

  it('gives up after the repair limit and never reports invalid output as ok', async () => {
    const broken = JSON.stringify({ sections: [{ type: 'carousel' }] });
    const provider = scriptedProvider(Array.from({ length: 10 }, () => broken));
    const result = await generateSections({ request: 'x', provider });
    expect(result.ok).toBe(false);
    expect(result.calls).toBe(MAX_REPAIR_ROUNDS + 1);
    expect(provider.requests).toHaveLength(MAX_REPAIR_ROUNDS + 1);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('passes images to the provider', async () => {
    const provider = scriptedProvider([HERO]);
    const images = [{ url: 'data:image/png;base64,AAAA', mimeType: 'image/png' }];
    await generateSections({ request: 'Rebuild this', provider, images });
    expect(provider.requests[0]!.images).toEqual(images);
    expect(provider.requests[0]!.prompt).toContain('screenshot');
  });
});
