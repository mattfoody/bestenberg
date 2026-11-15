# Changelog

## Unreleased
- M7: templates, header and footer are editable in the Bestenberg editor; "Site data" inserter for menu, search, post and store blocks; WooCommerce product, catalog, cart, checkout and order confirmation templates.
- M6: screenshot → page in the Generate dialog; `pnpm eval` harness scoring generated pages against fixtures (visual + structure).
- M5: Generate with AI — describe a page or section (optionally with a screenshot) and get editable sections built from the site's tokens and components; output is validated, repaired up to three times, and kept or discarded by the user. Uses the provider connected under Settings → Connectors. `bestenberg/get-design-system` ability for AI agents.
- M4: section library (hero, features, content, testimonials, pricing, call to action), links in text, background images with overlay, per-size overrides with "from …" hints and reset.
- M3: the Bestenberg editor — live canvas of the real page, inline text editing, structure tree with drag-and-drop, token inspector generated from the registry, viewport preview with "all sizes" / "this size and up" styling, undo/redo, save as native blocks, "Edit with Bestenberg" links.
- Self-hosted updates for the plugin and theme (Update URI + updater), `pnpm release:*` scripts and a tag-driven release workflow that uploads to the update server.
- M2: Bestenberg blocks (section, container, stack, row, grid, card, spacer) rendered by PHP; core block styling from Bestenberg data; WP-independent block adapter with lossless round trips and raw-block preservation; rich text/URL safety in TS and PHP; TS/PHP class parity; adapter markup verified in the real block editor.
- M1: design tokens and generators (theme.json, CSS variables, 552 bb: utilities), document schema + validation + JSON Schema, component/control registry, PHP style runtime (only used utilities per page), base theme and demo page.
- M0: repository, tooling, plugin/theme/editor scaffolds, local env and CI.
