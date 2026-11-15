import { createContext, useContext, useMemo, useReducer } from '@wordpress/element';
import type { Dispatch, ReactNode } from 'react';
import {
  clientPermissions,
  createHistory,
  findNode,
  pushHistory,
  redo,
  replaceHistory,
  undo,
  type Breakpoint,
  type Doc,
  type History,
  type Node,
} from '@bestenberg/schema';
import type { LoadedPost, PostSummary } from './api';

export type Viewport = 'mobile' | 'tablet' | 'desktop';
/** Where style changes apply: every size, or the current viewport and larger. */
export type Scope = 'all' | 'up';
/** Design: everything. Client: wording, pictures and links; structure only where the designer allows. */
export type Mode = 'design' | 'client';
/** What an edit needs: `content` and `arrange` can be open to clients, `design` never is. */
export type Permission = 'content' | 'arrange' | 'design';

export const VIEWPORT_BREAKPOINT: Record<Viewport, Breakpoint> = {
  mobile: 'base',
  tablet: 'tablet',
  desktop: 'desktop',
};

export interface Notice {
  kind: 'info' | 'error';
  text: string;
}

export interface EditorState {
  post: PostSummary | null;
  history: History<Doc> | null;
  /** The document as last loaded or saved (to know whether there are unsaved changes). */
  savedDoc: Doc | null;
  selectedId: string | null;
  viewport: Viewport;
  scope: Scope;
  mode: Mode;
  busy: 'loading' | 'saving' | null;
  notice: Notice | null;
  /** Sections the AI just added, waiting for the user to keep or discard them. */
  review: { sections: number } | null;
}

export type Action =
  | { type: 'loading' }
  | { type: 'loaded'; post: LoadedPost; doc: Doc }
  | { type: 'commit'; doc: Doc; select?: string | null; review?: { sections: number } }
  | { type: 'review-done' }
  | { type: 'replace'; doc: Doc }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; id: string | null }
  | { type: 'viewport'; viewport: Viewport }
  | { type: 'scope'; scope: Scope }
  | { type: 'mode'; mode: Mode }
  | { type: 'saving' }
  | { type: 'saved'; post: LoadedPost; doc: Doc }
  | { type: 'notice'; notice: Notice | null }
  | { type: 'failed'; text: string };

export const initialState: EditorState = {
  post: null,
  history: null,
  savedDoc: null,
  selectedId: null,
  viewport: 'desktop',
  scope: 'all',
  mode: 'design',
  busy: null,
  notice: null,
  review: null,
};

/** Keeps the selection only if that node still exists. */
function keepSelection(doc: Doc, id: string | null): string | null {
  return id !== null && findNode(doc.root, id) ? id : null;
}

export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'loading':
      return { ...state, busy: 'loading', notice: null };
    case 'loaded':
      return {
        ...state,
        post: action.post,
        history: createHistory(action.doc),
        savedDoc: action.doc,
        selectedId: null,
        busy: null,
        notice: null,
        review: null,
      };
    case 'commit': {
      if (!state.history) return state;
      const selectedId = action.select !== undefined ? action.select : state.selectedId;
      return {
        ...state,
        history: pushHistory(state.history, action.doc),
        selectedId: keepSelection(action.doc, selectedId),
        review: action.review ?? null,
      };
    }
    case 'replace':
      return state.history
        ? { ...state, history: replaceHistory(state.history, action.doc) }
        : state;
    case 'undo':
    case 'redo': {
      if (!state.history) return state;
      const history = action.type === 'undo' ? undo(state.history) : redo(state.history);
      return {
        ...state,
        history,
        selectedId: keepSelection(history.present, state.selectedId),
        review: null,
      };
    }
    case 'review-done': {
      return { ...state, review: null };
    }
    case 'select':
      return { ...state, selectedId: action.id };
    case 'viewport':
      return {
        ...state,
        viewport: action.viewport,
        scope: action.viewport === 'mobile' ? 'all' : state.scope,
      };
    case 'scope':
      return { ...state, scope: state.viewport === 'mobile' ? 'all' : action.scope };
    case 'mode':
      // Client mode has no per-size styling.
      return { ...state, mode: action.mode, scope: action.mode === 'client' ? 'all' : state.scope };
    case 'saving':
      return { ...state, busy: 'saving', notice: null };
    case 'saved':
      return {
        ...state,
        post: action.post,
        savedDoc: action.doc,
        busy: null,
        notice: { kind: 'info', text: 'Saved' },
      };
    case 'notice':
      return { ...state, notice: action.notice };
    case 'failed':
      return { ...state, busy: null, notice: { kind: 'error', text: action.text } };
  }
}

/** The breakpoint style changes are written to. */
export function targetBreakpoint(state: Pick<EditorState, 'viewport' | 'scope'>): Breakpoint {
  return state.scope === 'all' ? 'base' : VIEWPORT_BREAKPOINT[state.viewport];
}

export function currentDoc(state: EditorState): Doc | null {
  return state.history?.present ?? null;
}

export function selectedNode(state: EditorState): Node | null {
  const doc = currentDoc(state);
  return doc && state.selectedId ? (findNode(doc.root, state.selectedId)?.node ?? null) : null;
}

/** Whether the current mode allows this kind of edit on a node (null = the page itself). */
export function can(state: EditorState, id: string | null, permission: Permission): boolean {
  if (state.mode === 'design') return true;
  const doc = currentDoc(state);
  if (permission === 'design' || id === null || !doc) return false;
  return clientPermissions(doc, id)[permission];
}

export function isDirty(state: EditorState): boolean {
  return state.history !== null && state.history.present !== state.savedDoc;
}

interface Store {
  state: EditorState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (initial) => ({
    ...initial,
    mode: window.bestenbergEditor?.canDesign === false ? ('client' as const) : initial.mode,
  }));
  const store = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
