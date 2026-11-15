import type { Doc, Node } from './document';
import type { ControlDef } from './registry/types';

/**
 * Client mode (PLAN.md §4): what someone who edits content, but does not
 * design, may change. `node.locked` sets it per node:
 *
 * - `content` (default): text, images and links can be changed; structure is fixed.
 * - `all`: nothing can be changed. Applies to everything inside as well.
 * - `none`: as `content`, and the node's direct children can be duplicated,
 *   reordered and removed (a list of cards, team members, FAQ entries).
 */
export type Lock = NonNullable<Node['locked']>;

export const DEFAULT_LOCK: Lock = 'content';

export interface ClientPermissions {
  /** Text, images and links of the node can be changed. */
  content: boolean;
  /** The node can be duplicated, moved among its siblings and removed. */
  arrange: boolean;
}

const NOTHING: ClientPermissions = { content: false, arrange: false };

/** The node and its ancestors, outermost first; empty if the node is not in the document. */
export function nodePath(nodes: readonly Node[], id: string): Node[] {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const below = node.children ? nodePath(node.children, id) : [];
    if (below.length > 0) return [node, ...below];
  }
  return [];
}

/** The lock that applies to a node: its own, or the nearest ancestor's `all`. */
export function effectiveLock(doc: Doc, id: string): Lock {
  const path = nodePath(doc.root, id);
  const self = path[path.length - 1];
  if (!self) return 'all';
  if (self.locked) return self.locked;
  // Only "locked completely" is inherited; "children can be arranged" is not.
  for (let i = path.length - 2; i >= 0; i--) {
    const lock = path[i]!.locked;
    if (lock === 'all') return 'all';
    if (lock) break;
  }
  return DEFAULT_LOCK;
}

/** What a client may do with a node. */
export function clientPermissions(doc: Doc, id: string): ClientPermissions {
  const path = nodePath(doc.root, id);
  if (path.length === 0) return NOTHING;
  const lock = effectiveLock(doc, id);
  if (lock === 'all') return NOTHING;
  const parent = path[path.length - 2];
  return { content: true, arrange: parent?.locked === 'none' };
}

const CLIENT_KINDS: ReadonlySet<string> = new Set(['text', 'richtext', 'media', 'link', 'toggle']);
/** Content-group controls that change structure or behaviour rather than content. */
const DESIGNER_ONLY: ReadonlySet<string> = new Set(['anchor', 'ordered']);

/** Whether a control is offered in client mode: wording, pictures and link targets only. */
export function isClientControl(control: Pick<ControlDef, 'id' | 'group' | 'kind'>): boolean {
  return (
    control.group === 'content' && CLIENT_KINDS.has(control.kind) && !DESIGNER_ONLY.has(control.id)
  );
}
