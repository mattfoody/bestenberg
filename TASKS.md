# TASKS.md — Bestenberg

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

- [x] **1.1 Default tokens** (`packages/tokens/tokens.json`, DTCG):
  - color (semantic): `primary`, `on-primary`, `accent`, `surface`, `surface-alt`, `on-surface`, `muted`, `border`, `success`, `warning`, `danger`
  - space: `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24` (rem scale)
  - fontSize (fluid clamp): `xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl`
  - fontFamily `sans, serif, mono` · fontWeight `regular, medium, semibold, bold` · lineHeight `tight, snug, normal, relaxed`
  - radius `none, sm, md, lg, xl, full` · shadow `none, sm, md, lg, xl`
  - container `sm, md, lg, xl, 2xl` · breakpoint `md` (768px), `lg` (1024px)
- [x] **1.2 Token loader.** Zod validation + generated TS union types per category (`SpaceToken`, `ColorToken`, …).
- [x] **1.3 theme.json generator.** Presets from tokens; disable custom values (custom colors, gradients, font sizes, spacing units, line height, padding/margin free input); layout `contentSize`/`wideSize` from container tokens. Writes `wp/theme/theme.json`. Snapshot test.
- [x] **1.4 CSS variables.** `--bb-*` custom properties file. Test.
- [x] **1.5 Utility generator** (SCHEMA §6): `utilities.map.json` + `utilities.css`. Tests: Tailwind-style names with `bb:` prefix, mobile-first media query order, only token values, every style key covered. Print a size report.
- [x] **1.6 Schema package.** Types + zod for `Doc`, `Node`, `Style`, `Responsive`, `Binding` (SCHEMA §3); nanoid ids; uniqueness and nesting validation; JSON Schema export. Tests incl. invalid docs.
- [x] **1.7 Registry skeleton.** `ComponentDef`, `ControlDef`, `defineComponent`, `getComponent`, `listComponents`; shared control presets (spacing, typography, color, layout, visibility); `styleToClasses(style)` in TS. Register: `section`, `container`, `stack`, `row`, `grid`, `heading`, `text`, `button`, `image` (definitions only; `toBlock`/`fromBlock` come in M2).
- [x] **1.8 PHP style runtime.** `Bestenberg\Styles\Utilities` (loads map), `Collector` (records used classes during render), output of used rules only.
  - Block themes render the template before `wp_head`, so collection should finish in time. Verify; fall back to output buffering if needed and log it in DECISIONS.md.
  - Cache the per-page CSS by hash.
- [x] **1.9 Base theme.** Templates: `index`, `page`, `single`, `archive`, `404`; parts: `header`, `footer`. wp-env setup script creates a demo page.

**Done when:** the demo page renders with token styles, and page source contains only the utility rules that page uses.

---

## M2 — Blocks & adapter

- [x] **2.1 Layout blocks.** `bestenberg/{section,container,stack,row,grid,card,spacer}` via `block.json` (apiVersion 3), dynamic: `save` returns `InnerBlocks.Content` for containers, `null` otherwise. Attributes: `bbId`, `props`, `style`, `bind`, `locked`, `hidden`. Each has `render.php` that escapes all output and applies classes via the PHP style runtime.
- [x] **2.2 TS/PHP parity.** TS generates fixtures (`style → classes`); PHPUnit asserts PHP output matches. Runs in CI.
- [x] **2.3 Adapter: own blocks.** `toBlock` / `fromBlock` for all layout components.
- [x] **2.4 Adapter: core blocks.** heading, paragraph (`text`), list, buttons/button, image, separator (`divider`), quote. Store `bestenberg: { id, style, locked, hidden }` on the core block; a `render_block` filter adds the classes.
- [x] **2.5 Raw nodes.** Unknown blocks become read-only `raw` nodes that round-trip unchanged.
- [x] **2.6 Round-trip tests.** Property tests (fast-check): node → block → `serialize` → `parse` → `fromBlock` equals node. Include nested trees and responsive styles.
- [x] **2.7 TS → PHP render.** e2e: create a page from a TS-built doc via REST, load the frontend, assert no block errors, and snapshot the HTML.
- [x] **2.8 Security.** Rich-text sanitization (allowed inline tags only) in TS and PHP; XSS payload tests in props, attributes and URLs.

**Done when:** any valid schema doc round-trips losslessly, renders on the frontend with correct classes, and all tests pass in CI.

---

## M3 — Editor shell MVP

- [x] **3.1 Document operations.** Pure, immutable ops in `@bestenberg/schema` (`ops.ts`): find/update/remove/insert/move/duplicate, allowed-children rules, control values with mobile-first inheritance, undo/redo history, insert placement. Component `defaults` for new nodes.
- [x] **3.2 Client renderer.** `renderNodes()` in adapter-blocks produces the same HTML and classes as PHP, plus editor attributes (`data-bb-id`, `data-bb-text`, empty-container and raw placeholders).
- [x] **3.3 Canvas route.** `/?bestenberg-canvas=<id>&_wpnonce=…` renders the real theme around an empty canvas root (nonce + `edit_post`), with full utility CSS. `POST bestenberg/v1/render` renders raw blocks.
- [x] **3.4 Editor state.** Store (history, selection, viewport, scope, notices), REST load/save as block markup, page picker and new page.
- [x] **3.5 Canvas.** Iframe with hover/selection, inline text editing (sanitized rich text, bold/italic), floating toolbar (move, duplicate, delete).
- [x] **3.6 Structure panel.** Tree with selection, collapse, drag-and-drop that follows the registry's nesting rules, and an inserter.
- [x] **3.7 Inspector.** Generated from the control registry: token selects and colour swatches, segmented, toggle, select, columns, text, link, media library.
- [x] **3.8 Shell.** Top bar (viewport, "applies to" scope, undo/redo, view, save), keyboard shortcuts, unsaved-changes guard, "Edit with Bestenberg" row action.
- [x] **3.9 Tests.** Unit tests for ops and renderer; PHPUnit for canvas access and render endpoint; e2e: build, style, save, frontend, reload.

**Done when:** a page can be opened, edited on the canvas and in the inspector, saved as native blocks, and renders identically on the frontend.

---

## M4 — Responsive + library

- [x] **4.1 Breakpoint overrides.** Preview sizes with "all sizes" / "this size and up" scope; controls show the value in effect, where it is inherited from, and reset an override.
- [x] **4.2 Section library.** `packages/schema/src/library.ts`: hero, features, content, testimonials, pricing and call-to-action sections as schema nodes; validated in unit tests; inserted from the Sections tab.
- [x] **4.3 Links in text.** Link button while editing text: add, change and remove links (safe URLs only).
- [x] **4.4 Background image.** Media-library background image with colour overlay on layout components.
- [x] **4.5 Tests.** e2e: insert sections, link text, inherited values, frontend output.

**Done when:** overrides can be set per size and sections can be inserted from the library.

---

## M5 — AI from prompt

- [x] **5.1 Provider interface.** `ModelProvider` in `@bestenberg/ai` (one stateless call: system, prompt, images); scripted provider for tests.
- [x] **5.2 Prompts from the registry.** System prompt generated from components, style shape and tokens, with a library section as the example; user and repair prompts.
- [x] **5.3 Normalize and snap.** Model output → nodes: fresh ids, type/prop aliases, loose buttons and top-level content wrapped, rich text and URLs sanitized, every style value snapped to the nearest token (names, scale numbers, CSS lengths, hex colours).
- [x] **5.4 Validate and repair.** `generateSections()`: validate, feed problems back, at most 3 repair rounds, never returns invalid output as ok.
- [x] **5.5 WordPress AI Client.** `POST bestenberg/v1/ai/generate` forwards one call to the site's connected provider; `GET …/ai/status`; `bestenberg_pre_ai_generate` and `bestenberg_ai_available` filters for the hosted service and tests.
- [x] **5.6 Abilities API.** `bestenberg/get-design-system` (read-only) returns generated instructions, components and tokens.
- [x] **5.7 Editor.** Generate dialog (prompt, optional screenshot, add or replace), progress, and a keep/discard review bar; discard is an undo.
- [x] **5.8 Tests.** Unit tests for snapping, normalizing, prompts and the repair loop; PHPUnit for routes and ability; e2e with a scripted provider (repair, snapping, sanitizing, discard, keep, save).

**Done when:** a prompt produces valid sections in the editor, invalid output is repaired or rejected, and the user can keep or discard the result.

