import {
  defaultRegistry,
  getPattern,
  type Node,
  type Registry,
  type ValidationIssue,
} from '@bestenberg/schema';
import { GRID_COLUMNS, tokens } from '@bestenberg/tokens';
import { z } from 'zod/v4';
import { stripIds } from './normalize';

/**
 * Prompts are generated from the registry and tokens (SCHEMA.md §8), so a new
 * component or token is available to the model without editing prompt text.
 */

function propsSummary(schema: z.ZodObject): string {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any' }) as {
    properties?: Record<string, { type?: string; enum?: unknown[] }>;
    required?: string[];
  };
  const entries = Object.entries(json.properties ?? {});
  if (entries.length === 0) return 'none';
  return entries
    .map(([name, prop]) => {
      const type = prop.enum
        ? prop.enum.map((v) => JSON.stringify(v)).join('|')
        : (prop.type ?? 'any');
      return `${name}${json.required?.includes(name) ? '' : '?'}: ${type}`;
    })
    .join(', ');
}

function componentCatalog(registry: Registry): string {
  return registry
    .list()
    .filter((def) => !def.internal)
    .map((def) => {
      const children =
        def.allowedChildren === 'any'
          ? 'any component'
          : def.allowedChildren === 'none'
            ? 'none'
            : def.allowedChildren.join(', ');
      const parents = def.allowedParents ? `; only inside: ${def.allowedParents.join(', ')}` : '';
      return [
        `- ${def.type}: ${def.ai?.description ?? def.label}`,
        `  props: ${propsSummary(def.props)}`,
        `  style keys: ${def.styles.length > 0 ? def.styles.join(', ') : 'none'}`,
        `  children: ${children}${parents}`,
      ].join('\n');
    })
    .join('\n');
}

function tokenCatalog(): string {
  const names = (category: keyof typeof tokens) => Object.keys(tokens[category]).join(', ');
  return [
    `color.*: ${names('color')}`,
    `space.*: ${names('space')} (n × 0.25rem)`,
    `fontSize.*: ${names('fontSize')}`,
    `fontWeight.*: ${names('fontWeight')}`,
    `fontFamily.*: ${names('fontFamily')}`,
    `lineHeight.*: ${names('lineHeight')}`,
    `radius.*: ${names('radius')}`,
    `shadow.*: ${names('shadow')}`,
    `container.*: ${names('container')}`,
  ].join('\n');
}

const STYLE_SHAPE = `{
  layout?: { display?: "stack"|"row"|"grid", columns?: ${GRID_COLUMNS.join('|')}, gap?: space, align?: "start"|"center"|"end"|"stretch"|"baseline", justify?: "start"|"center"|"end"|"between"|"around"|"evenly", wrap?: boolean },
  padding?: { x?: space, y?: space },
  margin?: { top?: space, bottom?: space },
  width?: "auto"|"full"|container,
  height?: space,
  background?: color,
  color?: color,
  font?: { family?: fontFamily, size?: fontSize, weight?: fontWeight, lineHeight?: lineHeight, align?: "start"|"center"|"end" },
  radius?: radius, shadow?: shadow,
  border?: { width?: 0|1|2, color?: color },
  aspect?: "auto"|"1/1"|"4/3"|"3/4"|"16/9"
}`;

export function buildSystemPrompt(registry: Registry = defaultRegistry): string {
  const example = getPattern('hero-centered');
  return `You design web page sections for Bestenberg, a visual editor. You answer with one JSON object and nothing else.

# Output
{ "sections": Node[] }
Node = { "type": string, "props"?: object, "style"?: { "base": Style, "tablet"?: Style, "desktop"?: Style }, "children"?: Node[] }
Do not write ids. Do not write HTML, CSS, class names or markdown.

# Components
${componentCatalog(registry)}

# Style
Style = ${STYLE_SHAPE}
Every style value is a design token reference such as "space.6" or "color.primary" — never a raw value like "24px" or "#fff".
Styles are mobile-first: "base" applies to all screen sizes; "tablet" (≥768px) and "desktop" (≥1024px) only hold what changes. Multi-column grids use columns 1 in base and more columns in tablet or desktop.
Only use the style keys listed for each component.

# Tokens
${tokenCatalog()}

# Rules
- Every top-level node is a "section" that contains one "container".
- Buttons go inside a "button-group". List items go inside a "list".
- Text props may contain only <strong>, <em>, <a href> and <br>. Escape & as &amp;.
- Write real, specific copy for the request in the language of the request. No lorem ipsum.
- Images: use "src": "" (the user picks the image later) and describe the image in "alt".
- Use "color.on-primary" for text on "color.primary" backgrounds.
- One h1 at most (the page's main headline); section titles are level 2, card titles level 3.

# Example
${JSON.stringify({ sections: example ? stripIds(example.build()) : [] })}`;
}

export interface PromptContext {
  /** What the user asked for. */
  request: string;
  /** Outline of the page the sections will be added to, if any. */
  existing?: readonly Node[];
  /** True when the request comes with a screenshot to reproduce. */
  hasImage?: boolean;
}

/** One line per existing top-level section, so new content fits in. */
function outline(nodes: readonly Node[]): string {
  const firstText = (node: Node): string => {
    const own = typeof node.props?.text === 'string' ? node.props.text.replace(/<[^>]*>/g, '') : '';
    if (own !== '') return own;
    for (const child of node.children ?? []) {
      const found = firstText(child);
      if (found !== '') return found;
    }
    return '';
  };
  return nodes
    .slice(0, 20)
    .map((node, index) => `${index + 1}. ${node.type}: ${firstText(node).slice(0, 80)}`)
    .join('\n');
}

export function buildUserPrompt({ request, existing, hasImage }: PromptContext): string {
  const parts = [`Request: ${request.trim()}`];
  if (hasImage) {
    parts.push(
      'A screenshot is attached. Reproduce its layout, section order, text and relative emphasis with Bestenberg components. Map its colours and sizes to the nearest tokens. Transcribe visible text; where an image appears, add an image component with a descriptive alt.',
    );
  }
  if (existing && existing.length > 0) {
    parts.push(`The page already has these sections; do not repeat them:\n${outline(existing)}`);
  }
  parts.push('Answer with the JSON object only.');
  return parts.join('\n\n');
}

export function buildRepairPrompt(
  context: PromptContext,
  previous: string,
  issues: readonly ValidationIssue[],
): string {
  const list = issues
    .slice(0, 30)
    .map((issue) => `- ${issue.path}: ${issue.message}`)
    .join('\n');
  return `${buildUserPrompt(context)}

Your previous answer was not valid:
${previous.slice(0, 20000)}

Problems (paths start at "root", which is your "sections" array):
${list}

Answer again with the complete corrected JSON object only.`;
}
