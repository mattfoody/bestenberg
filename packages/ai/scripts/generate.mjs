#!/usr/bin/env node
/**
 * Writes the AI context derived from the registry and tokens:
 *   wp/plugin/generated/ai-context.php   instructions for external agents (Abilities API)
 *
 * Run after building the packages: `pnpm generate`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSystemPrompt } from '@bestenberg/ai';
import { defaultRegistry } from '@bestenberg/schema';
import { phpReturnFile, tokens } from '@bestenberg/tokens';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const file = resolve(root, 'wp/plugin/generated/ai-context.php');

const components = defaultRegistry
  .list()
  .filter((def) => !def.internal)
  .map((def) => ({
    type: def.type,
    label: def.label,
    category: def.category,
    block: def.block,
    description: def.ai?.description ?? '',
    styles: [...def.styles],
    children:
      typeof def.allowedChildren === 'string' ? def.allowedChildren : [...def.allowedChildren],
  }));

const tokenNames = Object.fromEntries(
  Object.entries(tokens)
    .filter(([category]) => category !== 'breakpoint')
    .map(([category, values]) => [category, Object.keys(values)]),
);

const contents = phpReturnFile(
  { instructions: buildSystemPrompt(defaultRegistry), components, tokens: tokenNames },
  'AI context: generation instructions, components and token names.',
  'the component registry and tokens.json',
);
await mkdir(dirname(file), { recursive: true });
await writeFile(file, contents);
console.log(`  wrote wp/plugin/generated/ai-context.php (${Buffer.byteLength(contents)} bytes)`);
