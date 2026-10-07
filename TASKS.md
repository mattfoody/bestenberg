# TASKS.md — Bestenberg M0–M2

> Work top to bottom. Tick boxes as you go. Stop at the end of each milestone, summarize, and wait for review. Specs: PLAN.md, SCHEMA.md.

---

## M0 — Repo & tooling

- [x] **0.1 Monorepo.** pnpm workspaces, root `package.json`, `tsconfig.base.json` (strict), `.nvmrc` (20), `.editorconfig`, `LICENSE` (GPL-2.0-or-later), `README.md`, `DECISIONS.md`, `CHANGELOG.md`.
- [x] **0.2 Packages.** Scaffold `packages/{schema,tokens,ai,adapter-blocks}` as `@bestenberg/*`: `src/index.ts`, build (tsup), Vitest, one passing test each.
- [x] **0.3 Plugin.** `wp/plugin/bestenberg.php` header:
  - Plugin Name: Bestenberg · Author: Matt Foody · Author URI: https://mattfoody.com
  - Requires at least: 7.1 · Requires PHP: 8.1 · License: GPL-2.0-or-later · Text Domain: bestenberg
  - Composer PSR-4 `Bestenberg\` → `src/`; `Plugin` bootstrap class; no logic yet.
- [x] **0.4 Theme.** `wp/theme/` minimal block theme: `style.css` header (same author), placeholder `theme.json`, `templates/index.html`.
- [x] **0.5 Editor app.** `wp/editor/` built with `@wordpress/scripts` (dependency extraction on). Admin menu "Bestenberg" opens a full-screen page mounting a React root that says "Bestenberg".
- [x] **0.6 Local env.** `.wp-env.json`: WP 7.1, PHP 8.3, plugin + theme mapped, WooCommerce installed, debug on. `pnpm env:start` / `env:stop` / `env:reset`.
- [x] **0.7 Quality tools.** ESLint + Prettier (TS/React), PHPCS (WPCS, `bestenberg` prefix rules), PHPStan level 6 with WP stubs, PHPUnit via wp-env, Playwright configured against wp-env.
- [x] **0.8 CI (GitHub Actions).** Jobs: lint, typecheck, unit (Vitest), PHP (PHPCS, PHPStan, PHPUnit on PHP 8.1 + 8.3), e2e smoke (plugin + theme + Woo activate; admin page loads with no console errors).
- [x] **0.9 CLAUDE.md commands.** Fill in the real commands in CLAUDE.md.

**Done when:** `pnpm i && pnpm env:start && pnpm test:all` passes locally and in CI.

---

## M1 — Tokens, schema, base theme

- [ ] **1.1 Default tokens** (`packages/tokens/tokens.json`, DTCG):
  - color (semantic): `primary`, `on-primary`, `accent`, `surface`, `surface-alt`, `on-surface`, `muted`, `border`, `success`, `warning`, `danger`
  - space: `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24` (rem scale)
  - fontSize (fluid clamp): `xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl`
  - fontFamily `sans, serif, mono` · fontWeight `regular, medium, semibold, bold` · lineHeight `tight, snug, normal, relaxed`
  - radius `none, sm, md, lg, xl, full` · shadow `none, sm, md, lg, xl`
  - container `sm, md, lg, xl, 2xl` · breakpoint `md` (768px), `lg` (1024px)
- [ ] **1.2 Token loader.** Zod validation + generated TS union types per category (`SpaceToken`, `ColorToken`, …).
- [ ] **1.3 theme.json generator.** Presets from tokens; disable custom values (custom colors, gradients, font sizes, spacing units, line height, padding/margin free input); layout `contentSize`/`wideSize` from container tokens. Writes `wp/theme/theme.json`. Snapshot test.
- [ ] **1.4 CSS variables.** `--bb-*` custom properties file. Test.
- [ ] **1.5 Utility generator** (SCHEMA §6): `utilities.map.json` + `utilities.css`. Tests: Tailwind-style names with `bb:` prefix, mobile-first media query order, only token values, every style key covered. Print a size report.
- [ ] **1.6 Schema package.** Types + zod for `Doc`, `Node`, `Style`, `Responsive`, `Binding` (SCHEMA §3); nanoid ids; uniqueness and nesting validation; JSON Schema export. Tests incl. invalid docs.
- [ ] **1.7 Registry skeleton.** `ComponentDef`, `ControlDef`, `defineComponent`, `getComponent`, `listComponents`; shared control presets (spacing, typography, color, layout, visibility); `styleToClasses(style)` in TS. Register: `section`, `container`, `stack`, `row`, `grid`, `heading`, `text`, `button`, `image` (definitions only; `toBlock`/`fromBlock` come in M2).
- [ ] **1.8 PHP style runtime.** `Bestenberg\Styles\Utilities` (loads map), `Collector` (records used classes during render), output of used rules only.
  - Block themes render the template before `wp_head`, so collection should finish in time. Verify; fall back to output buffering if needed and log it in DECISIONS.md.
  - Cache the per-page CSS by hash.
- [ ] **1.9 Base theme.** Templates: `index`, `page`, `single`, `archive`, `404`; parts: `header`, `footer`. wp-env setup script creates a demo page.

**Done when:** the demo page renders with token styles, and page source contains only the utility rules that page uses.

---

## M2 — Blocks & adapter

- [ ] **2.1 Layout blocks.** `bestenberg/{section,container,stack,row,grid,card,spacer}` via `block.json` (apiVersion 3), dynamic: `save` returns `InnerBlocks.Content` for containers, `null` otherwise. Attributes: `bbId`, `props`, `style`, `bind`, `locked`, `hidden`. Each has `render.php` that escapes all output and applies classes via the PHP style runtime.
- [ ] **2.2 TS/PHP parity.** TS generates fixtures (`style → classes`); PHPUnit asserts PHP output matches. Runs in CI.
- [ ] **2.3 Adapter: own blocks.** `toBlock` / `fromBlock` for all layout components.
- [ ] **2.4 Adapter: core blocks.** heading, paragraph (`text`), list, buttons/button, image, separator (`divider`), quote. Store `bestenberg: { id, style, locked, hidden }` on the core block; a `render_block` filter adds the classes.
- [ ] **2.5 Raw nodes.** Unknown blocks become read-only `raw` nodes that round-trip unchanged.
- [ ] **2.6 Round-trip tests.** Property tests (fast-check): node → block → `serialize` → `parse` → `fromBlock` equals node. Include nested trees and responsive styles.
- [ ] **2.7 TS → PHP render.** e2e: create a page from a TS-built doc via REST, load the frontend, assert no block errors, and snapshot the HTML.
- [ ] **2.8 Security.** Rich-text sanitization (allowed inline tags only) in TS and PHP; XSS payload tests in props, attributes and URLs.

**Done when:** any valid schema doc round-trips losslessly, renders on the frontend with correct classes, and all tests pass in CI.
