import { createId, type Doc, type Node } from './document';
import type { Registry } from './registry/registry';
import type { ControlDef } from './registry/types';
import { BREAKPOINTS, type Breakpoint } from './style';
import { RAW_TYPE } from './validate';

/**
 * Pure document operations used by the editor and the AI patch format
 * (SCHEMA.md §5, §8). Every function returns a new document and leaves its
 * input untouched, so undo/redo is a list of documents.
 */

export interface Located {
  node: Node;
  parent: Node | null;
  index: number;
  /** Ids from the root down to the node's parent. */
  ancestors: string[];
}

/** Finds a node by id. */
export function findNode(
  nodes: Node[],
  id: string,
  parent: Node | null = null,
  ancestors: string[] = [],
): Located | null {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]!;
    if (node.id === id) return { node, parent, index, ancestors };
    if (node.children) {
      const found = findNode(node.children, id, node, [...ancestors, node.id]);
      if (found) return found;
    }
  }
  return null;
}

function mapNodes(nodes: Node[], id: string, fn: (node: Node) => Node | null): Node[] {
  let changed = false;
  const out: Node[] = [];
  for (const node of nodes) {
    if (node.id === id) {
      const next = fn(node);
      changed = true;
      if (next) out.push(next);
      continue;
    }
    if (node.children) {
      const children = mapNodes(node.children, id, fn);
      if (children !== node.children) {
        changed = true;
        const { children: _dropped, ...rest } = node;
        out.push(children.length > 0 ? { ...rest, children } : rest);
        continue;
      }
    }
    out.push(node);
  }
  return changed ? out : nodes;
}

/** Replaces one node using `fn`. Unknown ids leave the document unchanged. */
export function updateNode(doc: Doc, id: string, fn: (node: Node) => Node): Doc {
  const root = mapNodes(doc.root, id, fn);
  return root === doc.root ? doc : { ...doc, root };
}

/** Removes a node and its subtree. */
export function removeNode(doc: Doc, id: string): Doc {
  const root = mapNodes(doc.root, id, () => null);
  return root === doc.root ? doc : { ...doc, root };
}

// ── Nesting rules ───────────────────────────────────────────────────────────

/** Whether `childType` may be placed inside `parentType` (null = top level). */
export function canContain(
  registry: Registry,
  parentType: string | null,
  childType: string,
): boolean {
  const child = registry.get(childType);
  if (!child) return false;
  if (parentType === null) return childType === RAW_TYPE || !child.allowedParents;
  const parent = registry.get(parentType);
  if (!parent || parent.allowedChildren === 'none') return false;
  if (childType === RAW_TYPE) return true;
  if (child.allowedParents && !child.allowedParents.includes(parentType)) return false;
  return parent.allowedChildren === 'any' || parent.allowedChildren.includes(childType);
}

/** Component types that may be inserted into `parentType`, in registry order. */
export function insertableTypes(registry: Registry, parentType: string | null): string[] {
  return registry
    .list()
    .filter((def) => !def.internal && canContain(registry, parentType, def.type))
    .map((def) => def.type);
}

// ── Creating and placing nodes ──────────────────────────────────────────────

/** A new node of `type` with the component's defaults and fresh ids. */
export function createNode(registry: Registry, type: string): Node {
  const def = registry.get(type);
  if (!def || def.internal) throw new Error(`Cannot create component "${type}"`);
  const node: Node = { id: createId(), type };
  const defaults = def.defaults;
  if (defaults?.props) node.props = structuredClone(defaults.props);
  if (defaults?.style) node.style = structuredClone(defaults.style);
  if (defaults?.children?.length) {
    node.children = defaults.children.map((child) => createNode(registry, child));
  }
  return node;
}

/** Deep copy with new ids (raw nodes keep theirs; they are derived from markup). */
export function cloneWithNewIds(node: Node): Node {
  const copy: Node = {
    ...structuredClone(node),
    id: node.type === RAW_TYPE ? `${node.id}-${createId().slice(0, 4)}` : createId(),
  };
  if (node.children) copy.children = node.children.map(cloneWithNewIds);
  return copy;
}

function insertInto(nodes: Node[], parentId: string | null, index: number, node: Node): Node[] {
  if (parentId === null) {
    const at = Math.max(0, Math.min(index, nodes.length));
    return [...nodes.slice(0, at), node, ...nodes.slice(at)];
  }
  return mapNodes(nodes, parentId, (parent) => {
    const children = parent.children ?? [];
    const at = Math.max(0, Math.min(index, children.length));
    return { ...parent, children: [...children.slice(0, at), node, ...children.slice(at)] };
  });
}

/** Inserts `node` under `parentId` (null = top level) at `index`. Throws if nesting rules forbid it. */
export function insertNode(
  doc: Doc,
  registry: Registry,
  parentId: string | null,
  index: number,
  node: Node,
): Doc {
  const parent = parentId === null ? null : findNode(doc.root, parentId)?.node;
  if (parentId !== null && !parent) throw new Error(`Unknown parent "${parentId}"`);
  if (!canContain(registry, parent?.type ?? null, node.type)) {
    throw new Error(`${node.type} cannot be placed in ${parent?.type ?? 'the page'}`);
  }
  return { ...doc, root: insertInto(doc.root, parentId, index, node) };
}

/** Whether `id` can move under `parentId` (not into itself or its own subtree). */
export function canMove(
  doc: Doc,
  registry: Registry,
  id: string,
  parentId: string | null,
): boolean {
  const moving = findNode(doc.root, id);
  if (!moving) return false;
  if (parentId === null) return canContain(registry, null, moving.node.type);
  if (parentId === id) return false;
  const target = findNode(doc.root, parentId);
  if (!target || target.ancestors.includes(id)) return false;
  return canContain(registry, target.node.type, moving.node.type);
}

/** Moves a node. `index` counts positions in the target before the move. */
export function moveNode(
  doc: Doc,
  registry: Registry,
  id: string,
  parentId: string | null,
  index: number,
): Doc {
  if (!canMove(doc, registry, id, parentId)) return doc;
  const moving = findNode(doc.root, id)!;
  const sameParent = (moving.parent?.id ?? null) === parentId;
  const at = sameParent && moving.index < index ? index - 1 : index;
  if (sameParent && at === moving.index) return doc;
  const without = removeNode(doc, id);
  return { ...without, root: insertInto(without.root, parentId, at, moving.node) };
}

/** Duplicates a node right after itself; returns the new document and the copy's id. */
export function duplicateNode(doc: Doc, id: string): { doc: Doc; id: string | null } {
  const found = findNode(doc.root, id);
  if (!found) return { doc, id: null };
  const copy = cloneWithNewIds(found.node);
  return {
    doc: { ...doc, root: insertInto(doc.root, found.parent?.id ?? null, found.index + 1, copy) },
    id: copy.id,
  };
}

// ── Reading and writing control values ──────────────────────────────────────

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function getPath(source: unknown, keys: string[]): unknown {
  let current = source;
  for (const key of keys) {
    if (!isBag(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** Sets a nested value; `undefined` deletes it and prunes containers that become empty. */
function setPath(source: Bag | undefined, keys: string[], value: unknown): Bag | undefined {
  const [key, ...rest] = keys as [string, ...string[]];
  const bag = { ...(source ?? {}) };
  const next =
    rest.length === 0
      ? value
      : setPath(isBag(bag[key]) ? (bag[key] as Bag) : undefined, rest, value);
  if (next === undefined) delete bag[key];
  else bag[key] = next;
  return Object.keys(bag).length > 0 ? bag : undefined;
}

function splitPath(path: string): { root: string; keys: string[] } {
  const [root, ...keys] = path.split('.') as [string, ...string[]];
  return { root, keys };
}

/** The value a control shows for one breakpoint (its own value, not inherited). */
export function getControlValue(
  node: Node,
  control: Pick<ControlDef, 'path' | 'responsive'>,
  breakpoint: Breakpoint = 'base',
): unknown {
  const { root, keys } = splitPath(control.path);
  if (root === 'style') {
    return getPath(node.style?.[control.responsive ? breakpoint : 'base'], keys);
  }
  return getPath((node as unknown as Bag)[root], keys);
}

/**
 * The value in effect at a breakpoint and where it comes from: mobile-first,
 * so desktop inherits tablet, which inherits base.
 */
export function resolveControlValue(
  node: Node,
  control: Pick<ControlDef, 'path' | 'responsive'>,
  breakpoint: Breakpoint,
): { value: unknown; from: Breakpoint | null } {
  const { root, keys } = splitPath(control.path);
  if (root !== 'style' || !control.responsive) {
    const value = getControlValue(node, control, 'base');
    return { value, from: value === undefined ? null : 'base' };
  }
  for (let i = BREAKPOINTS.indexOf(breakpoint); i >= 0; i--) {
    const from = BREAKPOINTS[i]!;
    const value = getPath(node.style?.[from], keys);
    if (value !== undefined) return { value, from };
  }
  return { value: undefined, from: null };
}

/** Writes a control value; `undefined` clears it. Empty containers are removed. */
export function setControlValue(
  node: Node,
  control: Pick<ControlDef, 'path' | 'responsive'>,
  value: unknown,
  breakpoint: Breakpoint = 'base',
): Node {
  const { root, keys } = splitPath(control.path);
  const next = { ...node } as Node & Bag;

  if (root === 'style') {
    const target = control.responsive ? breakpoint : 'base';
    const style: Bag = { ...(node.style ?? {}) };
    const updated = setPath(style[target] as Bag | undefined, keys, value);
    if (updated === undefined) delete style[target];
    else style[target] = updated;
    const hasValues = BREAKPOINTS.some(
      (bp) => isBag(style[bp]) && Object.keys(style[bp]).length > 0,
    );
    if (!hasValues) delete next.style;
    else next.style = { base: {}, ...style } as Node['style'];
    return next;
  }

  if (keys.length === 0) {
    if (value === undefined) delete next[root];
    else next[root] = value;
    return next;
  }
  const updated = setPath(next[root] as Bag | undefined, keys, value);
  // `props` stays present (possibly empty) so core-block components round-trip.
  if (updated === undefined && root !== 'props') delete next[root];
  else next[root] = updated ?? {};
  return next;
}

// ── History ─────────────────────────────────────────────────────────────────

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Records a new state. Identical states are ignored; redo history is dropped. */
export function pushHistory<T>(history: History<T>, present: T): History<T> {
  if (present === history.present) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present, future: [] };
}

/** Replaces the current state without adding an undo step (e.g. while typing). */
export function replaceHistory<T>(history: History<T>, present: T): History<T> {
  return { ...history, present };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
