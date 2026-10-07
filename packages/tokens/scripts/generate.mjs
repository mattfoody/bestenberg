#!/usr/bin/env node
/**
 * Writes every file generated from tokens.json:
 *   packages/tokens/src/generated/names.ts   token name lists + union types
 *   wp/theme/theme.json                      presets, free values disabled
 *   wp/plugin/generated/variables.css        --bb-* custom properties
 *   wp/plugin/generated/utilities.css        full utility set (editor canvas)
 *   wp/plugin/generated/utilities.map.json   class → [order, media, css]
 *   wp/plugin/generated/utilities.map.php    same, for the PHP runtime
 *
 * Run after building @bestenberg/tokens: `pnpm generate`.
 * BESTENBERG_TOKENS_ENTRY can point at another module (e.g. src via tsx).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const entry = process.env.BESTENBERG_TOKENS_ENTRY
  ? pathToFileURL(resolve(process.env.BESTENBERG_TOKENS_ENTRY)).href
  : new URL('../dist/index.js', import.meta.url).href;

const {
  tokens,
  generateNamesModule,
  generateThemeJson,
  generateCssVariables,
  buildUtilityMap,
  generateUtilitiesCss,
  phpReturnFile,
} = await import(entry);

async function pretty(file, source, parser) {
  const config = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(source, { ...config, parser });
}

async function write(relative, contents) {
  const file = resolve(root, relative);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
  console.log(`  wrote ${relative} (${Buffer.byteLength(contents)} bytes)`);
}

const map = buildUtilityMap(tokens);

const namesFile = 'packages/tokens/src/generated/names.ts';
await write(
  namesFile,
  await pretty(resolve(root, namesFile), generateNamesModule(tokens), 'typescript'),
);

const themeFile = 'wp/theme/theme.json';
await write(
  themeFile,
  await pretty(resolve(root, themeFile), JSON.stringify(generateThemeJson(tokens)), 'json'),
);

await write('wp/plugin/generated/variables.css', generateCssVariables(tokens));
await write('wp/plugin/generated/utilities.css', generateUtilitiesCss(map));
await write('wp/plugin/generated/utilities.map.json', `${JSON.stringify(map)}\n`);
await write(
  'wp/plugin/generated/utilities.map.php',
  phpReturnFile(map, 'Utility class map: class => [order, media key, css].'),
);

console.log(`  ${Object.keys(map.rules).length} utility classes`);
