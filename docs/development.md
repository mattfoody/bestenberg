# Development

Start with [PLAN.md](../PLAN.md) (principles, architecture), [SCHEMA.md](../SCHEMA.md) (data
model) and [DECISIONS.md](../DECISIONS.md) (why things are the way they are).

## Layout

```
packages/tokens          design tokens → theme.json, CSS variables, bb: utilities
packages/schema          document model, component registry, validation, editing operations, locks
packages/adapter-blocks  documents ⇄ WordPress block markup, client renderer, theme and demo content
packages/ai              prompt → validated sections; eval harness
wp/plugin                PHP: blocks, styles, canvas, REST, updates, license, demo importer
wp/editor                React editor (only @wordpress/element and api-fetch)
wp/theme                 base block theme (templates are generated)
tests/e2e                Playwright
```

Only `wp/` and `packages/adapter-blocks` know about WordPress.

## Commands

See the table in [CLAUDE.md](../CLAUDE.md). The usual loop:

```bash
pnpm install && composer --working-dir=wp/plugin install
pnpm env:start            # WordPress + WooCommerce at http://localhost:8888 (admin / password)
pnpm --filter @bestenberg/editor start
pnpm test && pnpm test:php && pnpm test:e2e
```

Without Docker: `bin/wp-sqlite.sh setup && bin/wp-sqlite.sh start` runs WordPress with SQLite.

## Generated files

`pnpm generate` writes everything derived from tokens and the registry: `theme.json`, CSS,
`block.json` files, PHP config, parity fixtures, theme templates, demo pages. Never edit
those by hand; CI fails when they are stale.

## Adding a component

1. Define it in `packages/schema/src/registry/components.ts`: props (zod), allowed styles,
   allowed children, controls, defaults.
2. Stored as a core block? Add its save/extract pair in
   `packages/adapter-blocks/src/core-blocks.ts`. Rendered by Bestenberg? Give it an
   `element` definition; the PHP renderer and the canvas renderer both follow it.
3. `pnpm generate`, then run the tests: round trip, TS/PHP class parity and the editor
   validity e2e cover new components automatically.

The inspector, the inserter, validation and the AI prompt are all generated from the
registry; there is no editor code to write for a new component.

## Adding a section or site-data block

- Section: a builder in `packages/schema/src/library.ts`.
- Site data: an entry in `packages/adapter-blocks/src/dynamic.ts` (block markup kept verbatim).

## Rules that keep it maintainable

- Storage is always native block markup; unknown blocks are preserved byte for byte.
- No free CSS values: styles are token references.
- Output is escaped in PHP; rich text is sanitised in TypeScript and PHP.
- Every edit in the editor is a pure function on the document (`packages/schema/src/ops.ts`).
