import {
  defaultRegistry,
  validateDoc,
  type Doc,
  type Node,
  type Registry,
  type ValidationIssue,
} from '@bestenberg/schema';
import { normalizeNodes, stripIds } from './normalize';
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt } from './prompt';
import type { ModelImage, ModelProvider } from './provider';

/** Maximum validation/repair rounds before giving up (SCHEMA.md §8). */
export const MAX_REPAIR_ROUNDS = 3 as const;

export interface GenerateOptions {
  /** What the user asked for. */
  request: string;
  provider: ModelProvider;
  registry?: Registry;
  /** Screenshot(s) to reproduce (M6). */
  images?: ModelImage[];
  /** Top-level nodes of the page being added to, for context. */
  existing?: readonly Node[];
  /** Called before each model call: round 0 is the first attempt, 1–3 are repairs. */
  onRound?: (round: number, issues: readonly ValidationIssue[]) => void;
}

export interface GenerateResult {
  ok: boolean;
  /** Valid sections when `ok`; otherwise the last (invalid) attempt, for inspection. */
  nodes: Node[];
  /** Model calls made (1 = valid first time). */
  calls: number;
  /** Remaining problems when not `ok`. */
  issues: ValidationIssue[];
}

/** The JSON value inside a model answer, tolerating code fences and surrounding prose. */
export function extractJson(answer: string): unknown {
  const text = answer.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidates = [text, fenced?.[1]?.trim()];
  const start = text.search(/[{[]/);
  if (start !== -1) {
    const close = text[start] === '{' ? '}' : ']';
    const end = text.lastIndexOf(close);
    if (end > start) candidates.push(text.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

function check(nodes: Node[], registry: Registry): ValidationIssue[] {
  if (nodes.length === 0) return [{ path: 'root', message: 'no sections were returned' }];
  const doc: Doc = { schemaVersion: 1, kind: 'page', meta: { title: 'Generated' }, root: nodes };
  const result = validateDoc(doc, { registry });
  return result.ok ? [] : result.issues;
}

/**
 * Prompt (and optional screenshot) → valid sections (PLAN.md §6): call the
 * model, normalize and snap tokens, validate, and feed problems back for up
 * to MAX_REPAIR_ROUNDS repairs. Never returns invalid nodes as `ok`.
 */
export async function generateSections(options: GenerateOptions): Promise<GenerateResult> {
  const registry = options.registry ?? defaultRegistry;
  const system = buildSystemPrompt(registry);
  const context = {
    request: options.request,
    existing: options.existing,
    hasImage: (options.images?.length ?? 0) > 0,
  };

  let prompt = buildUserPrompt(context);
  let nodes: Node[] = [];
  let issues: ValidationIssue[] = [];

  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    options.onRound?.(round, issues);
    const answer = await options.provider.generate({ system, prompt, images: options.images });
    const json = extractJson(answer);
    if (json === undefined) {
      nodes = [];
      issues = [{ path: 'root', message: 'the answer was not valid JSON' }];
      prompt = buildRepairPrompt(context, answer, issues);
      continue;
    }
    nodes = normalizeNodes(json, registry);
    issues = check(nodes, registry);
    if (issues.length === 0) return { ok: true, nodes, calls: round + 1, issues: [] };
    prompt = buildRepairPrompt(context, JSON.stringify({ sections: stripIds(nodes) }), issues);
  }
  return { ok: false, nodes, calls: MAX_REPAIR_ROUNDS + 1, issues };
}
