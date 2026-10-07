import { z } from 'zod/v4';
import { DocSchema, walk, type Doc, type Node } from './document';
import type { Registry } from './registry/registry';
import { BREAKPOINTS } from './style';

export interface ValidationIssue {
  /** Location in the document, e.g. `root[0].children[1].style.base.padding.y`. */
  path: string;
  message: string;
}

export interface ValidationSuccess {
  ok: true;
  doc: Doc;
  issues: [];
}

export interface ValidationFailure {
  ok: false;
  issues: ValidationIssue[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/** `['root', 0, 'children', 1]` → `root[0].children[1]`. */
export function formatPath(parts: readonly PropertyKey[], base = ''): string {
  return parts.reduce<string>((path, part) => {
    if (typeof part === 'number') return `${path}[${part}]`;
    const key = String(part);
    return path === '' ? key : `${path}.${key}`;
  }, base);
}

function zodIssues(error: z.ZodError, base = ''): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: formatPath(issue.path, base) || '(document)',
    message: issue.message,
  }));
}

function checkNode(
  registry: Registry,
  node: Node,
  path: string,
  parent: Node | undefined,
  issues: ValidationIssue[],
): void {
  const def = registry.get(node.type);
  if (!def) {
    issues.push({ path: `${path}.type`, message: `unknown component "${node.type}"` });
    return;
  }

  const props = def.props.safeParse(node.props ?? {});
  if (!props.success) issues.push(...zodIssues(props.error, `${path}.props`));

  for (const bp of BREAKPOINTS) {
    const style = node.style?.[bp];
    if (!style) continue;
    for (const key of Object.keys(style)) {
      if (!(def.styles as readonly string[]).includes(key)) {
        issues.push({
          path: `${path}.style.${bp}.${key}`,
          message: `style "${key}" is not allowed on ${def.type}`,
        });
      }
    }
  }

  const children = node.children ?? [];
  if (def.allowedChildren === 'none' && children.length > 0) {
    issues.push({ path: `${path}.children`, message: `${def.type} cannot have children` });
  } else if (Array.isArray(def.allowedChildren)) {
    children.forEach((child, index) => {
      if (!def.allowedChildren.includes(child.type)) {
        issues.push({
          path: `${path}.children[${index}]`,
          message: `${child.type} is not allowed inside ${def.type}`,
        });
      }
    });
  }

  if (parent && def.allowedParents && !def.allowedParents.includes(parent.type)) {
    issues.push({ path, message: `${def.type} must be inside ${def.allowedParents.join(' or ')}` });
  }
}

/**
 * Validates a document: structure (zod), unique ids, and — when a registry is
 * given — component types, props, allowed styles and nesting. Issues carry
 * paths so they can be fed back to the AI for repair (SCHEMA.md §8).
 */
export function validateDoc(
  input: unknown,
  options: { registry?: Registry } = {},
): ValidationResult {
  const parsed = DocSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };

  const doc = parsed.data as Doc;
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();

  walk(doc.root, (node, path, parent) => {
    const first = seen.get(node.id);
    if (first !== undefined) {
      issues.push({ path: `${path}.id`, message: `duplicate id "${node.id}" (first at ${first})` });
    } else {
      seen.set(node.id, path);
    }
    if (options.registry) checkNode(options.registry, node, path, parent, issues);
  });

  return issues.length === 0 ? { ok: true, doc, issues: [] } : { ok: false, issues };
}

/** JSON Schema (draft 2020-12) for a document — used for AI structured output. */
export function docJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(DocSchema) as Record<string, unknown>;
}
