# DECISIONS.md

Log of non-obvious choices. Newest at the bottom. Format: date — decision — reason.

- 2026-10-07 — Editor app lives in `wp/editor/` as a pnpm workspace package (`@bestenberg/editor`) and builds into `wp/plugin/build/editor/`. — The plugin directory is the only thing shipped; keeping build output inside it means wp-env maps one folder.
- 2026-10-07 — TS packages build with tsup (ESM + d.ts); a single root Vitest config runs all package tests. — One command for all unit tests; per-package configs add noise.
- 2026-10-07 — wp-env pins WordPress via the official `wordpress-7.1.zip` URL and WooCommerce via `latest-stable`. — Matches PLAN minimum (7.1); Woo follows stable releases.
- 2026-10-07 — Local Node is 22 in some environments; `.nvmrc` stays 20 (minimum) and CI tests on 20. — Lowest supported version is what CI must prove.
