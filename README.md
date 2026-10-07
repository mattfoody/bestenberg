# Bestenberg

AI-native visual editor on Gutenberg, by [Matt Foody](https://mattfoody.com).

Bestenberg replaces the default Site Editor UX with a fast, opinionated, token-based visual editor. AI generates pages, templates and sections from prompts or screenshots. Everything is stored as native WordPress blocks, so sites keep working without the plugin.

- Vision, principles, milestones: [PLAN.md](PLAN.md)
- Data model, tokens, registry, CSS: [SCHEMA.md](SCHEMA.md)
- Current tasks: [TASKS.md](TASKS.md)
- Decisions log: [DECISIONS.md](DECISIONS.md)

## Requirements

Node 20+, pnpm 10, PHP 8.1+, Composer, Docker (for `wp-env`).

## Getting started

```bash
pnpm install
composer --working-dir=wp/plugin install
pnpm env:start          # WordPress 7.1 + WooCommerce at http://localhost:8888 (admin / password)
pnpm test:all
```

## Layout

```
packages/        WP-agnostic TypeScript (@bestenberg/schema, tokens, ai, adapter-blocks)
wp/plugin/       PHP plugin
wp/editor/       React editor app (built into wp/plugin/build)
wp/theme/        Base block theme
tests/e2e/       Playwright tests against wp-env
```

## License

GPL-2.0-or-later.
