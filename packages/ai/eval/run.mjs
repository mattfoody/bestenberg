#!/usr/bin/env node
/**
 * Screenshot eval harness (PLAN.md §6):
 *   fixture page → reference screenshot → model (screenshot → sections)
 *   → generated page → screenshot → visual + structural similarity.
 *
 * Usage (after `pnpm build`):
 *   node packages/ai/eval/run.mjs                      oracle provider, checks the harness itself (CI)
 *   node packages/ai/eval/run.mjs --provider=openai    a real model through an OpenAI-compatible API:
 *       BESTENBERG_EVAL_API_KEY, BESTENBERG_EVAL_MODEL, BESTENBERG_EVAL_BASE_URL (default https://api.openai.com/v1)
 *   --min=0.8        fail when the mean score is lower
 *   --out=DIR        where screenshots and report.json go (default test-results/eval)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { renderNodes } from '@bestenberg/adapter-blocks';
import { generateSections, stripIds, structureScore } from '@bestenberg/ai';
import { getPattern } from '@bestenberg/schema';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);
const providerName = args.provider ?? 'oracle';
const minimum = Number(args.min ?? (providerName === 'oracle' ? 0.99 : 0));
const outDir = resolve(root, args.out ?? 'test-results/eval');
const WIDTH = 1280;

/** Fixture pages: combinations of library sections. */
const FIXTURES = [
  { id: 'landing', patterns: ['hero-centered', 'features-grid', 'cta-banner'] },
  { id: 'story', patterns: ['hero-split', 'content-image-text', 'testimonials'] },
  { id: 'pricing', patterns: ['content-text', 'pricing-three'] },
].map((fixture) => ({
  ...fixture,
  nodes: fixture.patterns.flatMap((id) => getPattern(id).build()),
}));

const css = (
  await Promise.all(
    ['variables.css', 'utilities.css'].map((file) =>
      readFile(resolve(root, 'wp/plugin/generated', file), 'utf8'),
    ),
  )
).join('\n');

/** A standalone page: the same renderer and token CSS as the editor canvas, without WordPress. */
function pageHtml(nodes) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
*{box-sizing:border-box}
body{margin:0;font:1rem/1.6 system-ui,sans-serif;color:var(--bb-color-on-surface);background:var(--bb-color-surface)}
h1,h2,h3,h4,p,ul,ol,blockquote,figure{margin:0}
img{display:block;width:100%;min-height:200px;background:#c9ced6}
.wp-block-buttons{display:flex;gap:.75rem;flex-wrap:wrap}
.wp-block-button__link{display:inline-block;padding:.75rem 1.5rem;border-radius:.5rem;background:var(--bb-color-primary);color:var(--bb-color-on-primary);text-decoration:none}
.is-style-secondary .wp-block-button__link{background:var(--bb-color-surface);color:var(--bb-color-on-surface);box-shadow:inset 0 0 0 1px var(--bb-color-border)}
</style></head><body>${renderNodes(nodes)}</body></html>`;
}

// ── Providers ────────────────────────────────────────────────────────────────

/** Answers with the fixture itself: verifies the harness, not a model. */
const oracle = (fixture) => ({
  generate: async () => JSON.stringify({ sections: stripIds(fixture.nodes) }),
});

/** Answers with a visibly worse page: the scores must notice. */
const degraded = (fixture) => ({
  generate: async () =>
    JSON.stringify({
      sections: [
        {
          type: 'section',
          children: [
            {
              type: 'container',
              children: [{ type: 'heading', props: { text: fixture.id, level: 1 } }],
            },
          ],
        },
      ],
    }),
});

/** Any OpenAI-compatible chat completions API with image input. */
const openai = () => {
  const key = process.env.BESTENBERG_EVAL_API_KEY;
  const model = process.env.BESTENBERG_EVAL_MODEL;
  const base = process.env.BESTENBERG_EVAL_BASE_URL ?? 'https://api.openai.com/v1';
  if (!key || !model) {
    throw new Error('Set BESTENBERG_EVAL_API_KEY and BESTENBERG_EVAL_MODEL for --provider=openai.');
  }
  return {
    async generate({ system, prompt, images = [] }) {
      const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                ...images.map((image) => ({ type: 'image_url', image_url: { url: image.url } })),
              ],
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`Model API ${response.status}: ${await response.text()}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? '';
    },
  };
};

const PROVIDERS = { oracle, degraded, openai };
if (!PROVIDERS[providerName]) {
  throw new Error(`Unknown provider "${providerName}". Use: ${Object.keys(PROVIDERS).join(', ')}.`);
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/** Visual similarity of two screenshots at thumbnail size, relative to a blank page (0–1). */
async function visualScore(page, a, b) {
  return page.evaluate(
    async ([first, second]) => {
      const load = (src) =>
        new Promise((done, fail) => {
          const image = new Image();
          image.onload = () => done(image);
          image.onerror = fail;
          image.src = src;
        });
      const images = await Promise.all([load(first), load(second)]);
      const width = 96;
      const height = Math.max(
        ...images.map((image) => Math.round((image.height / image.width) * width)),
      );
      const pixels = images.map((image) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, Math.round((image.height / image.width) * width));
        return context.getImageData(0, 0, width, height).data;
      });
      // Pages are mostly background, so raw pixel difference flatters empty results.
      // Score against a blank page instead: 0 = no better than blank, 1 = identical.
      let difference = 0;
      let blank = 0;
      for (let i = 0; i < pixels[0].length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          difference += Math.abs(pixels[0][i + channel] - pixels[1][i + channel]);
          blank += 255 - pixels[0][i + channel];
        }
      }
      return blank === 0 ? 1 : Math.max(0, 1 - difference / blank);
    },
    [a, b],
  );
}

// ── Run ──────────────────────────────────────────────────────────────────────

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: 800 } });

async function screenshot(nodes, file) {
  await page.setContent(pageHtml(nodes));
  const buffer = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 80 });
  await writeFile(resolve(outDir, file), buffer);
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

const rows = [];
for (const fixture of FIXTURES) {
  const reference = await screenshot(fixture.nodes, `${fixture.id}.reference.jpg`);
  const result = await generateSections({
    request: 'Rebuild the page in the screenshot.',
    provider: PROVIDERS[providerName](fixture),
    images: [{ url: reference, mimeType: 'image/jpeg' }],
  });
  if (!result.ok) {
    rows.push({
      fixture: fixture.id,
      ok: false,
      calls: result.calls,
      visual: 0,
      structure: 0,
      score: 0,
    });
    continue;
  }
  const generated = await screenshot(result.nodes, `${fixture.id}.${providerName}.jpg`);
  await page.setContent('<!doctype html>');
  const visual = await visualScore(page, reference, generated);
  const structure = structureScore(fixture.nodes, result.nodes).score;
  rows.push({
    fixture: fixture.id,
    ok: true,
    calls: result.calls,
    visual: Number(visual.toFixed(4)),
    structure: Number(structure.toFixed(4)),
    score: Number(((visual + structure) / 2).toFixed(4)),
  });
}
await browser.close();

const mean = rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
const report = { provider: providerName, mean: Number(mean.toFixed(4)), minimum, rows };
await writeFile(
  resolve(outDir, `report.${providerName}.json`),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.table(rows);
console.log(`provider=${providerName} mean=${report.mean} minimum=${minimum}`);

if (args['expect-below'] !== undefined) {
  // Sanity check for the metric itself: a bad answer must score low.
  if (mean >= Number(args['expect-below'])) {
    console.error(`Expected a mean below ${args['expect-below']}, got ${report.mean}.`);
    process.exit(1);
  }
} else if (mean < minimum) {
  console.error(`Mean score ${report.mean} is below the minimum ${minimum}.`);
  process.exit(1);
}
