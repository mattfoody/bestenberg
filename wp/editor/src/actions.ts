import type { Dispatch } from 'react';
import { docToMarkup, markupToNodes } from '@bestenberg/adapter-blocks';
import {
  createNode,
  defaultRegistry as registry,
  duplicateNode,
  findNode,
  getPattern,
  insertNode,
  insertPlacement,
  moveNode,
  removeNode,
  setControlValue,
  updateNode,
  validateDoc,
  type ControlDef,
  type Doc,
} from '@bestenberg/schema';
import { errorMessage, loadPost, savePost, type LoadedPost } from './api';
import { currentDoc, targetBreakpoint, type Action, type EditorState } from './store';

export { registry };

/** The document for a post's stored markup. */
export function docFromPost(post: LoadedPost): Doc {
  return {
    schemaVersion: 1,
    kind: 'page',
    meta: { title: post.title.trim() === '' ? 'Untitled' : post.title },
    root: markupToNodes(post.content),
  };
}

export async function openPost(
  dispatch: Dispatch<Action>,
  rest: string,
  id: number,
): Promise<void> {
  dispatch({ type: 'loading' });
  try {
    const post = await loadPost(rest, id);
    dispatch({ type: 'loaded', post, doc: docFromPost(post) });
    const url = new URL(window.location.href);
    url.searchParams.set('post', String(id));
    window.history.replaceState(null, '', url);
  } catch (error) {
    dispatch({ type: 'failed', text: `This page could not be opened. ${errorMessage(error)}` });
  }
}

export async function save(state: EditorState, dispatch: Dispatch<Action>): Promise<void> {
  const doc = currentDoc(state);
  if (!doc || !state.post || state.busy) return;
  const check = validateDoc(doc, { registry });
  if (!check.ok) {
    const first = check.issues[0]!;
    dispatch({ type: 'failed', text: `Not saved: ${first.message} (${first.path}).` });
    return;
  }
  dispatch({ type: 'saving' });
  try {
    const post = await savePost(state.post.rest, state.post.id, docToMarkup(doc));
    dispatch({ type: 'saved', post, doc });
  } catch (error) {
    dispatch({ type: 'failed', text: `Not saved. ${errorMessage(error)}` });
  }
}

/** Adds a new component relative to the selection. Returns false if it has no place. */
export function insert(state: EditorState, dispatch: Dispatch<Action>, type: string): boolean {
  const doc = currentDoc(state);
  if (!doc) return false;
  const place = insertPlacement(doc, registry, state.selectedId, type);
  if (!place) return false;
  const node = createNode(registry, type);
  dispatch({
    type: 'commit',
    doc: insertNode(doc, registry, place.parentId, place.index, node),
    select: node.id,
  });
  return true;
}

export function remove(state: EditorState, dispatch: Dispatch<Action>, id: string): void {
  const doc = currentDoc(state);
  if (!doc) return;
  const parent = findNode(doc.root, id)?.parent ?? null;
  dispatch({ type: 'commit', doc: removeNode(doc, id), select: parent?.id ?? null });
}

export function duplicate(state: EditorState, dispatch: Dispatch<Action>, id: string): void {
  const doc = currentDoc(state);
  if (!doc) return;
  const result = duplicateNode(doc, id);
  if (result.id) dispatch({ type: 'commit', doc: result.doc, select: result.id });
}

export function move(
  state: EditorState,
  dispatch: Dispatch<Action>,
  id: string,
  parentId: string | null,
  index: number,
): void {
  const doc = currentDoc(state);
  if (doc) dispatch({ type: 'commit', doc: moveNode(doc, registry, id, parentId, index) });
}

/** Moves a node one step earlier (-1) or later (+1) among its siblings. */
export function nudge(
  state: EditorState,
  dispatch: Dispatch<Action>,
  id: string,
  by: -1 | 1,
): void {
  const doc = currentDoc(state);
  const found = doc ? findNode(doc.root, id) : null;
  if (!doc || !found) return;
  const index = by === -1 ? found.index - 1 : found.index + 2;
  if (index < 0) return;
  move(state, dispatch, id, found.parent?.id ?? null, index);
}

export function setControl(
  state: EditorState,
  dispatch: Dispatch<Action>,
  id: string,
  control: Pick<ControlDef, 'path' | 'responsive'>,
  value: unknown,
): void {
  const doc = currentDoc(state);
  if (!doc) return;
  const breakpoint = targetBreakpoint(state);
  dispatch({
    type: 'commit',
    doc: updateNode(doc, id, (node) => setControlValue(node, control, value, breakpoint)),
  });
}

/** Adds a library section after the top-level section that holds the selection (or at the end). */
export function insertPattern(state: EditorState, dispatch: Dispatch<Action>, id: string): boolean {
  const doc = currentDoc(state);
  const pattern = getPattern(id);
  if (!doc || !pattern) return false;
  const selected = state.selectedId ? findNode(doc.root, state.selectedId) : null;
  const topId = selected ? (selected.ancestors[0] ?? selected.node.id) : null;
  const after = topId ? doc.root.findIndex((node) => node.id === topId) : -1;
  const index = after === -1 ? doc.root.length : after + 1;
  const nodes = pattern.build();
  const root = [...doc.root.slice(0, index), ...nodes, ...doc.root.slice(index)];
  dispatch({ type: 'commit', doc: { ...doc, root }, select: nodes[0]?.id ?? null });
  return true;
}
