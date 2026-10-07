# SCHEMA.md — Bestenberg data model & control registry

> Companion to PLAN.md. Defines the single source of truth that drives the editor UI, AI output, validation, block serialization and CSS.

## 1. One source, many outputs
```
tokens.json ─┐
             ├─► registry (TS) ─┬─► zod validators        (packages/schema)
components ──┘                  ├─► JSON Schema for AI    (packages/ai, structured output)
                                ├─► editor controls       (wp/editor)
                                ├─► schema ⇄ block mapper (packages/adapter-blocks)
                                └─► CSS utility classes   (packages/tokens → PHP render)
```
Nothing is defined twice. Adding a component or token means editing the registry only; everything else is generated.

## 2. Design tokens
- Format: W3C Design Tokens (DTCG) JSON in `packages/tokens/tokens.json`.
- Categories: `color`, `space`, `fontFamily`, `fontSize` (fluid, clamp), `fontWeight`, `lineHeight`, `radius`, `shadow`, `container` (max widths), `breakpoint`.
- Token references in the schema are strings: `"space.4"`, `"color.primary"`, `"fontSize.xl"`.
- Outputs: `theme.json` presets + settings (free values disabled), CSS custom properties `--bb-*`, and the utility class set.
- Breakpoints: `base` (mobile), `tablet`, `desktop`. **Mobile-first**: `base` applies everywhere; overrides cascade up via `min-width` queries (tablet ≥ token `breakpoint.tablet`, desktop ≥ `breakpoint.desktop`).
- The editor opens in desktop view by default, but edits there write to the `desktop` override unless the control is set to "all sizes".

## 3. Document schema
```ts
type Doc = {
  schemaVersion: 1;
  kind: "page" | "template" | "part" | "pattern";
  meta: { title: string; slug?: string; templateFor?: string }; // e.g. "single-product"
  root: Node[];
};

type Node = {
  id: string;                    // stable, unique in doc (nanoid)
  type: ComponentType;           // registry key, e.g. "section", "heading", "product-price"
  props?: Record<string, unknown>; // content & behavior, validated per component
  style?: Responsive<Style>;     // token refs only
  children?: Node[];             // only if component allows children
  bind?: Binding;                // dynamic data (query, Woo product fields)
  locked?: "none" | "content" | "all"; // client mode
  hidden?: Partial<Record<Breakpoint, boolean>>;
};

type Responsive<T> = { base: T; tablet?: Partial<T>; desktop?: Partial<T> }; // base = mobile

type Style = {
  layout?: { display: "stack" | "row" | "grid"; columns?: 1|2|3|4|5|6|12;
             gap?: SpaceToken; align?: Align; justify?: Justify; wrap?: boolean };
  padding?: { x?: SpaceToken; y?: SpaceToken };
  margin?:  { top?: SpaceToken; bottom?: SpaceToken };      // vertical only
  width?: "auto" | "full" | ContainerToken;
  background?: ColorToken | { image: MediaRef; overlay?: ColorToken };
  color?: ColorToken;
  font?: { family?: FontFamilyToken; size?: FontSizeToken; weight?: FontWeightToken;
           lineHeight?: LineHeightToken; align?: "start"|"center"|"end" };
  radius?: RadiusToken; shadow?: ShadowToken;
  border?: { width: 0|1|2; color: ColorToken };
  aspect?: "auto" | "1/1" | "4/3" | "16/9" | "3/4";
};

type Binding =
  | { source: "query"; postType: string; perPage: number; orderBy?: string; filters?: object }
  | { source: "woo/product"; field: "title"|"price"|"image"|"gallery"|"rating"|"stock"|"add-to-cart"|"description" }
  | { source: "woo/context"; kind: "cart"|"checkout"|"account"|"order" };
```
Rules:
- Rich text in `props.text`: limited inline HTML (`strong`, `em`, `a`, `br`, `span.bb-*`), sanitized on both sides.
- Nesting is validated per component (`allowedChildren`, `allowedParents`).
- No raw CSS, no raw HTML node, no free numeric styles anywhere in the schema.

## 4. Component registry
```ts
type ComponentDef = {
  type: ComponentType;
  label: string; icon: string;
  category: "layout" | "content" | "media" | "commerce" | "navigation";
  block: string;                      // "bestenberg/section" | "core/heading" | "woocommerce/product-price"
  props: ZodObject;                   // content/behavior props
  styles: StyleKey[];                 // which Style keys are allowed
  allowedChildren?: ComponentType[] | "any" | "none";
  allowedParents?: ComponentType[];
  controls: ControlDef[];             // editor UI (see §5)
  toBlock(node): BlockInstance;       // schema → block (pure)
  fromBlock(block): Node;             // block → schema (pure, round-trip safe)
  ai?: { description: string; examples?: Node[] }; // fed to the model
};
```
v1 components:
| Category | Types |
|---|---|
| layout | `section`, `container`, `stack`, `row`, `grid`, `card`, `spacer` |
| content | `heading`, `text`, `list`, `button`, `button-group`, `icon`, `quote`, `divider` |
| media | `image`, `video`, `gallery`, `embed` |
| navigation | `nav-menu`, `site-logo`, `site-title`, `breadcrumbs`, `search` |
| data | `query-list`, `post-title`, `post-excerpt`, `post-image`, `post-date`, `pagination` |
| commerce | `product-grid`, `product-title`, `product-price`, `product-image`, `product-gallery`, `product-rating`, `product-stock`, `add-to-cart`, `product-tabs`, `mini-cart`, `cart`, `checkout`, `account`, `order-confirmation`, `product-filters` |

Commerce and data types wrap Woo/core blocks; layout types are Bestenberg dynamic blocks.

## 5. Control registry (editor UI)
```ts
type ControlDef = {
  id: string;
  group: "content" | "layout" | "spacing" | "typography" | "color" | "effects" | "visibility" | "data";
  label: string;
  kind: "token" | "segmented" | "toggle" | "text" | "richtext" | "media" | "link"
      | "select" | "columns" | "binding" | "query";
  path: string;                       // "style.padding.y" | "props.level" | "bind.perPage"
  token?: TokenCategory;              // for kind "token"
  options?: { value: unknown; label: string; icon?: string }[];
  responsive?: boolean;               // shows breakpoint indicator, writes to style[bp]
  showIf?: (node: Node) => boolean;   // contextual visibility
  quick?: boolean;                    // also shown in floating toolbar
};
```
UI rules:
- Fixed group order: Content → Layout → Spacing → Typography → Color → Effects → Visibility → Data. Empty groups are hidden.
- Controls write to the **schema node**; the adapter updates block attributes via the `core/block-editor` store. The editor never edits block attributes directly.
- Responsive controls show which breakpoint they edit and a dot when an override exists; one click resets to base.
- `quick: true` controls also appear in a floating toolbar next to the selection (max ~5).
- Shared control presets (`spacingControls`, `typographyControls`, …) keep components consistent.

## 6. Styles → CSS
- **Tailwind-compatible naming, own generator, no Tailwind dependency.**
  - Class names follow Tailwind v4 conventions with a `bb:` prefix, mobile-first: `bb:py-4` (all sizes), `bb:md:py-6` (≥ tablet), `bb:lg:grid-cols-3` (≥ desktop), `bb:bg-primary`, `bb:text-xl`, `bb:rounded-lg`.
  - Breakpoint variants: `md` = tablet, `lg` = desktop (values from tokens).
  - Values are **token names only**. No arbitrary values (`[13px]`), no classes outside the generated set.
- **Generator** (`packages/tokens/generate-utilities.ts`, a few hundred lines): tokens × style keys × breakpoints → `utilities.map.json` (`class → CSS rule`) + `utilities.css` (full set, for the editor canvas). Runs at plugin build time; output committed to the plugin build.
- **Runtime (PHP, no Node):** `render.php` maps `style` → class list; a render collector records used classes and outputs **only those rules** from the map per page (inline `<style>` or cached file keyed by hash).
- Schema stores structured `style` (not class strings); classes are always derived. AI may *think* in Tailwind, but outputs schema. A helper `tailwindToStyle()` can parse common Tailwind classes into schema style for screenshot/HTML import.
- Theme developers may use real Tailwind for their own components on a different prefix; Bestenberg never depends on it.
- Core/Woo blocks receive the same classes via `render_block` filter; their own presentational CSS is minimized via `theme.json`.
- No inline `style=""` except background images.

## 7. Serialization
- Stored form is always block markup (PLAN §2.1). Bestenberg blocks store `{ id, props, style, bind, locked, hidden }` as attributes; core/Woo blocks store their native attributes plus `bestenberg: { id, style, locked, hidden }`.
- `fromBlock(toBlock(node))` must equal `node` (property test with generated nodes).
- Unknown blocks found in content are preserved as an opaque `raw` node (read-only, movable, deletable) so nothing is ever lost.

## 8. AI contract
- The model receives: JSON Schema generated from the registry, component `ai.description`s, the token list, and optionally the current doc.
- It returns a `Doc` or a patch (`{ op: "insert"|"replace"|"update"|"remove", target: id, node? }`) for "edit selection".
- Validation errors are returned to the model verbatim for repair (max 3 rounds).
- Screenshots are usually desktop: the model must still output mobile as `base` with `tablet`/`desktop` overrides (e.g. grid `columns: 1` base, `desktop.columns: 3`). Prompt includes this rule and an example; validator flags docs with desktop-only layouts.
- Off-token values (e.g. a hex color from a screenshot) are snapped to the nearest token; if the distance is too large, the editor suggests adding a token.

## 9. Versioning
- `schemaVersion` increments on breaking changes; `packages/schema/migrations/` holds pure `vN → vN+1` functions with tests.
