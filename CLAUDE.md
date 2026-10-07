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
_(fill in during task 0.9)_
