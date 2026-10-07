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
