# DECISIONS.md

Log of non-obvious choices. Newest at the bottom. Format: date — decision — reason.

- 2026-10-07 — Editor app lives in `wp/editor/` as a pnpm workspace package (`@bestenberg/editor`) and builds into `wp/plugin/build/editor/`. — The plugin directory is the only thing shipped; keeping build output inside it means wp-env maps one folder.
- 2026-10-07 — TS packages build with tsup (ESM + d.ts); a single root Vitest config runs all package tests. — One command for all unit tests; per-package configs add noise.
- 2026-10-07 — wp-env pins WordPress via the official `wordpress-7.1.zip` URL and WooCommerce via the `woocommerce.zip` (latest stable) URL so the plugin folder is `woocommerce`. — Matches PLAN minimum (7.1); Woo follows stable releases.
- 2026-10-07 — Local Node is 22 in some environments; `.nvmrc` stays 20 (minimum) and CI tests on 20. — Lowest supported version is what CI must prove.
- 2026-10-07 — Lockfiles committed by Matt after the first local install; CI now installs with `--frozen-lockfile` and setup-node caching. — Reproducible CI.
- 2026-10-07 — TypeScript `~5.9` and ESLint 9 (flat config) rather than TS 6 / ESLint 10. — typescript-eslint support for the newest majors was unverified; upgrade together later.
- 2026-10-07 — PHPUnit 9.6 + Yoast polyfills, run inside wp-env's tests container. — The WordPress core test library targets PHPUnit 9; polyfills keep tests forward-compatible.
- 2026-10-07 — Full-screen editor page hides WP admin chrome with a body class + CSS rather than a custom admin template. — Least invasive; keeps admin notices, capabilities and screen handling standard.
- 2026-10-07 — ESLint `no-restricted-imports` enforces "no `@wordpress/*` in packages/ except adapter-blocks". — Makes PLAN.md §2.6 a build error instead of a convention.
- 2026-10-07 — Token references in documents are full refs (`"space.4"`, `"color.primary"`), typed from generated name lists. — Self-describing for AI and validation; matches SCHEMA.md §2.
- 2026-10-07 — Packages expose a `source` export condition; TS (`customConditions`) and Vitest (aliases) use sources, tsup builds against sibling `dist` via `tsconfig.build.json`. — Typecheck and tests work before anything is built; published output stays standard.
- 2026-10-07 — Width tokens map to `bb:container-{name}` (width 100%, max-width, centered) rather than Tailwind's `max-w-*`. — One class does what a container needs; the name says so.
- 2026-10-07 — `bb:flex` / `bb:grid` also reset `margin-block-start` on children. — WordPress flow layout adds block-gap margins to children; inside flex/grid, spacing must come from `gap` only.
- 2026-10-07 — Visibility uses exact-range classes (`bb:max-md:hidden`, `bb:md:max-lg:hidden`, `bb:lg:hidden`) with `!important`. — "Hide on tablet" must not cascade to desktop, and must beat display utilities.
- 2026-10-07 — Utility map ships as both `utilities.map.php` (runtime, opcache-friendly) and `.json` (tooling/tests). — No JSON decode per request.
- 2026-10-07 — The PHP collector reads `bb:` classes from each block's `className` attribute (via `render_block`), not by re-parsing HTML. — Exact and cheap; nested blocks would otherwise be re-scanned at every level. `record_html()` remains for other sources.
- 2026-10-07 — Used utilities go out via `wp_add_inline_style` at `wp_enqueue_scripts` (block themes render the template before `wp_head`), plus a late footer style for classes first seen afterwards. — Standard WP asset API, CSS in <head>, nothing lost on classic themes.
- 2026-10-07 — `composer.lock` is refreshed by the manual "Refresh composer.lock" workflow (PHP 8.1). — Keeps the lock resolvable for the minimum PHP version; no local Composer needed.
- 2026-10-11 — The adapter implements the block grammar and the nine core blocks' save/extract itself instead of depending on @wordpress/blocks in Node. — Runs anywhere (server, AI, tests) with no DOM or WordPress; the real editor validates its output in e2e, so drift from core is caught in CI.
- 2026-10-11 — Block conversion lives in adapter-blocks keyed by component type; the registry only names the block and, for own blocks, describes the element. — Keeps the registry WP-agnostic (PLAN §2.2).
- 2026-10-11 — Utility classes for core blocks are added at render time from the `bestenberg` attribute, not saved in `className`. — Content stays free of Bestenberg class names, so naming can change without migrations and editing in core Gutenberg cannot corrupt them.
- 2026-10-11 — Own-block attribute for the node id is `bbId` (core blocks: `bestenberg.id`). — Avoids clashing with any `id` a future WordPress feature may add.
- 2026-10-11 — Property tests use a seeded generator written in the test file instead of fast-check. — No new dependency (CLAUDE.md); seeds make failures reproducible.
- 2026-10-11 — Image props are `src`, `alt`, `mediaId`; width/height removed. — Size comes from width/aspect tokens; core image width attributes would reintroduce free values.
- 2026-10-11 — Added `height` style key (`bb:h-*`) for the spacer block. — A spacer needs an explicit token height; padding hacks are fragile.
- 2026-10-11 — Button variants are stored as `is-style-{variant}` className, including `primary`. — Exact round-trip; absent variant stays absent.
- 2026-10-11 — Lists are `list` → `list-item` children (nested lists inside items), quotes hold `text` children; buttons must sit in a `button-group`. — Mirrors core block structure, so conversion is 1:1.
- 2026-10-11 — e2e checks adapter output structurally (editor validity, frontend CSS) rather than with a stored HTML snapshot; the generated `adapter-page.html` fixture is the reviewable snapshot and CI fails if it is stale. — Snapshot files cannot be produced in this workspace; the fixture serves the same purpose.
- 2026-10-12 — Updates are self-hosted: plugin and theme declare `Update URI`, and Bestenberg's own updater answers `update_plugins_<host>`/`update_themes_<host>` from static `info.json` files on Matt's VPS. — Native WordPress mechanism (no update library dependency); works for Matt's sites and customers alike; pulled forward from M9. Licensing/token checks come later.
- 2026-10-12 — Releases are tag-driven: `pnpm release:bump` sets all version strings and tags; the Release workflow builds, rsyncs zips then info.json to the VPS, and creates a GitHub release. The same scripts run locally. — One path for CI and manual releases; zips before metadata so sites never see a missing package.
