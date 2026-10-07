# PLAN.md — Bestenberg

> AI-native visual editor on Gutenberg. Status: draft v0.4. Items marked **[OPEN]** are undecided. Data model and controls: see **SCHEMA.md**.

## 0. Identity
| Item | Value |
|---|---|
| Product | Bestenberg |
| Author | Matt Foody — https://mattfoody.com |
| Plugin slug / text domain | `bestenberg` |
| PHP namespace / prefix | `Bestenberg\` / `bestenberg_` |
| Block namespace | `bestenberg/` |
| npm scope | `@bestenberg/*` |
| CSS prefix | `bb-` |
| License | GPL-2.0-or-later (plugin + theme) |

## 1. Vision
A commercial WordPress product (plugin + base block theme) that replaces the default Site Editor UX with a fast, opinionated visual editor. AI can generate full pages, templates and sections from a prompt or a screenshot. Designers and end customers both use it. Targets marketing sites and WooCommerce stores.

## 2. Principles (non-negotiable)
1. **Native storage.** Everything persists as standard block markup, templates, template parts and `theme.json`. If the product is uninstalled, sites keep rendering.
2. **WordPress is an adapter, not the core.** Schema, design system and AI live in WP-agnostic packages. WP is the first output target; static HTML or headless can come later.
3. **Opinionated design system.** Users pick from design tokens (spacing, type scale, colors, radii, shadows). No free-form pixel values in the default UI.
4. **Schema-first AI.** AI outputs our own validated JSON schema, never raw block markup. The adapter converts schema to blocks deterministically.
5. **Fast frontend.** PHP SSR, no jQuery, minimal JS via the Interactivity API, per-page block CSS only.
6. **Depend on stable WP surfaces.** Block parser/serializer, block registration, data stores, REST. Avoid Site Editor internals. Isolate every `@wordpress/*` import behind our own wrappers.

## 3. Architecture

```
/packages            (TypeScript, no WordPress dependencies)
  schema/            Section/component schema (zod + JSON Schema export), types
  tokens/            Design tokens → theme.json + CSS custom properties
  ai/                Prompt/screenshot → schema; validate + repair loop
  adapter-blocks/    schema ⇄ block markup (serialize + parse, round-trip safe)
/wp
  plugin/            PHP plugin: admin app page, REST endpoints, custom blocks,
                     Abilities API registration, AI integration, licensing
  editor/            React editor app (built on @wordpress/block-editor)
  theme/             Minimal base block theme; theme.json generated from tokens
/tests
  e2e/               Playwright against wp-env
  fixtures/          Screenshots + prompts + expected schema (AI eval set)
```

- Monorepo: pnpm workspaces. Node 20+, TypeScript strict.
- WP build: `@wordpress/scripts` with dependency extraction (use WP-bundled React and `@wordpress/*`). Minimum WP **7.1**, PHP **8.1**.
- Tests: Vitest (packages), PHPUnit (plugin), Playwright (e2e + visual diff).
- Local env: `@wordpress/env` with WooCommerce installed.

## 4. Editor UX (v1)
- Own full-screen admin app; does not reuse the Site Editor chrome.
- **Canvas:** iframe rendering real frontend styles.
- **Structure panel:** layer tree with drag/drop, rename, lock, hide.
- **Inspector:** token-based controls only (layout, spacing, typography, color, borders). Grouped, minimal, no nested "advanced" panels.
- **Responsive:** desktop/tablet/mobile switcher with per-breakpoint overrides stored as block attributes → generated CSS.
- **Library:** sections and full-page patterns (our own, generated from schema).
- **AI panel:** generate page/section from prompt or screenshot; "edit selection with AI"; preview diff before applying.
- **Modes:** Designer (full control) and Client (content editing only, structure locked via block locking / templateLock).
- Edits pages, posts, templates and template parts.

## 5. Blocks
- **Dynamic by default.** Own blocks store attributes only (`save` returns null or InnerBlocks); PHP renders via `render.php`. Reasons: AI outputs attributes only (no validation errors), markup can change between versions without deprecations, output is escaped at render time.
- Own small set: `section`, `container`, `grid`, `stack`, `card`, `media`, `button-group`, `icon`.
- Reuse core blocks where good enough (heading, paragraph, image, list, navigation, query loop) and Woo blocks for commerce.
- **One UI for all blocks.** Core and Woo blocks are reused for their data and rendering only; the editor never shows default Gutenberg controls.
  - Hide the default `BlockInspector`, block toolbar and support panels in our app.
  - A **control registry** maps each supported block (ours, core, Woo) to our own token-based controls, reading/writing attributes through the `core/block-editor` store.
  - Disable unwanted core supports and free values via `theme.json` settings and `register_block_type_args` / `blocks.registerBlockType` filters.
  - Blocks without a registry entry are not insertable.
  - Known limit: some core blocks render their own in-canvas UI (placeholders, inline toolbars). Where it conflicts, wrap or replace with our own block (decide per case, log in `DECISIONS.md`).

## 5b. Frontend runtime — server-first, JS-enhanced
- **HTML first:** PHP-rendered dynamic blocks + full-page cache. Primary content is never fetched by JS (protects LCP and SEO).
- **Islands:** Interactivity API (`viewScriptModule`) only on blocks with real interaction (tabs, accordions, sliders, variations, filters, mini-cart).
- **App-like navigation:** Interactivity API router for client-side region navigation + speculation rules prefetch on hover/viewport.
- **Progressive loading only for slow or per-user data:** cart, stock, filtering/search results, account, personalization. Skeleton states and progress indicators are built into those blocks.
- **Lazy loading:** media, below-the-fold sections, heavy islands load on visibility.
- **Assets:** per-page block CSS and JS only; no jQuery; JS budget enforced in CI (e.g. ≤ 30 KB gzip on a marketing page excluding Woo).
- **Security:** all trust on the server (escaping in `render.php`, capabilities, nonces, Store API validation). Minimal frontend JS keeps XSS and supply-chain surface small.
- **Perf checks in CI:** Lighthouse/Playwright on demo pages; fail on LCP/CLS/JS budget regressions.

## 6. AI pipeline
1. Input: prompt, screenshot, or both (+ optional existing page as context).
2. Model call with structured output (JSON schema / tool use) → schema JSON.
3. Validate with zod; on failure, run a repair loop (max N retries with error feedback).
4. Snap values to nearest design tokens.
5. Adapter serializes schema → block markup.
6. Show preview/diff in editor; user accepts or rejects.
- Expose actions via the Abilities API (create section, restyle page, generate template).
- Provider: **both.** (a) Bring-your-own-key through the WP 7.x AI Client (provider-agnostic). (b) Optional hosted service with credits/subscription as an upsell. `packages/ai` defines one `ModelProvider` interface; both are implementations. The hosted service is a separate deployable (`/services/ai-gateway`), started after M6.
- Eval harness: fixture screenshots → generated page → Playwright screenshot → visual similarity score. Run in CI on a small set; full set on demand.

## 7. WooCommerce
- v1 scope: **full store.** Single product, product archive/category, cart, checkout, mini-cart, my account, order confirmation.
- Use Woo blocks + Store API; never replace checkout logic. Style and arrange only.
- E2E: complete purchase flow test (add to cart → checkout → order received) on wp-env with Woo test payment gateway.

## 8. Milestones
| # | Milestone | Done when |
|---|---|---|
| M0 | Repo setup | Monorepo, wp-env + Woo, lint, CI, test runners green |
| M1 | Schema + tokens + base theme | Tokens generate `theme.json`; theme renders demo page |
| M2 | Blocks + adapter | Own blocks registered; schema ⇄ markup round-trips in tests |
| M3 | Editor shell MVP | Open/edit/save a page: canvas, structure panel, token inspector |
| M4 | Responsive + library | Breakpoint overrides work; insert sections from library |
| M5 | AI from prompt | Prompt → valid page inserted, repair loop, preview/accept |
| M6 | AI from screenshot + eval | Screenshot → page; eval harness in CI |
| M7 | Templates + Woo | Edit templates/parts; Woo templates per §7 scope |
| M8 | Client mode | Locked structure, content-only editing, onboarding |
| M9 | Ship | Licensing, updates, packaging, docs, demo site |

## 9. Non-goals (v1)
Headless output, multilingual, real-time collaboration, importing from other builders, hosted site builder/SaaS.

## 10. Open decisions
- ✅ AI: BYO key + hosted credits (§6).
- ✅ Woo: full store in v1 (§7).
- ✅ Editor: own full-screen admin app (§4).
- ✅ Name: Bestenberg, by Matt Foody (§0).
- **[OPEN]** Pricing and license tiers (code is GPL; sell updates, support, hosted AI credits).

## 11. Instructions for Claude Code
- Work one milestone at a time; stop and summarize at the end of each.
- Write tests alongside code; keep `adapter-blocks` round-trip tests mandatory.
- Ask before adding dependencies or changing principles in §2.
- Never import `@wordpress/*` outside `wp/` and `adapter-blocks/`.
- Keep a `DECISIONS.md` log of every non-obvious choice.
