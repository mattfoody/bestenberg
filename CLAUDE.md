# Bestenberg — instructions for Claude Code

AI-native visual editor on Gutenberg, by Matt Foody (https://mattfoody.com).

## Read first
- `PLAN.md` — vision, principles, architecture, milestones
- `SCHEMA.md` — data model, tokens, component & control registry, CSS
- `TASKS.md` — current task list (work top to bottom)
- `DECISIONS.md` — log of non-obvious choices (append to it)

## Rules
- One milestone at a time. Stop at its end, summarize, and wait for review.
- Never break the principles in PLAN.md §2 without asking.
- Ask before adding dependencies.
- `@wordpress/*` imports only in `wp/` and `packages/adapter-blocks/`.
- Schema/registry is the single source of truth; never hand-write what can be generated from it.
- Tests alongside code; round-trip and TS/PHP parity tests are mandatory.
- Escape all output in PHP; sanitize rich text on both sides.

## Commands
Requirements: Node 20+, pnpm 10, PHP 8.1+, Composer, Docker.

| Task | Command |
|---|---|
| Install | `pnpm install && composer --working-dir=wp/plugin install` |
| Build packages + editor | `pnpm build` |
| Editor watch mode | `pnpm --filter @bestenberg/editor start` |
| Start WordPress (http://localhost:8888, admin/password) | `pnpm env:start` |
| Stop / reset WordPress | `pnpm env:stop` / `pnpm env:reset` |
| Unit tests (Vitest) | `pnpm test` |
| PHP tests (PHPUnit in wp-env) | `pnpm test:php` |
| E2E (Playwright, needs wp-env) | `pnpm test:e2e` (first time: `pnpm exec playwright install chromium`) |
| Lint JS / PHP | `pnpm lint:js` / `pnpm lint:php` |
| Static analysis | `pnpm stan` |
| Typecheck | `pnpm typecheck` |
| Everything | `pnpm test:all` |

CI: `.github/workflows/ci.yml` runs JS, PHP (8.1 + 8.3) and WordPress (PHPUnit + e2e) jobs on every push and PR.
