import { useCallback, useEffect, useRef } from '@wordpress/element';
import { duplicate, openPost, remove, save } from './actions';
import { settings } from './api';
import { Canvas } from './canvas/Canvas';
import { Inspector } from './panels/Inspector';
import { Structure } from './panels/Structure';
import { TopBar } from './panels/TopBar';
import { StoreProvider, isDirty, useStore } from './store';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

function Editor() {
  const { state, dispatch } = useStore();
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const { postId, postRest } = settings();
    if (postId > 0) void openPost(dispatch, postRest, postId);
  }, [dispatch]);

  const onShortcut = useCallback(
    (event: KeyboardEvent) => {
      const current = stateRef.current;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 's') {
        event.preventDefault();
        void save(current, dispatch);
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (mod && key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (mod && key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod && key === 'd' && current.selectedId) {
        event.preventDefault();
        duplicate(current, dispatch, current.selectedId);
      } else if ((key === 'delete' || key === 'backspace') && current.selectedId) {
        event.preventDefault();
        remove(current, dispatch, current.selectedId);
      } else if (key === 'escape') {
        dispatch({ type: 'select', id: null });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [onShortcut]);

  const dirty = isDirty(state);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // "Saved" clears itself; errors stay until dismissed.
  const notice = state.notice;
  useEffect(() => {
    if (notice?.kind !== 'info') return;
    const timer = window.setTimeout(() => dispatch({ type: 'notice', notice: null }), 2500);
    return () => window.clearTimeout(timer);
  }, [notice, dispatch]);

  return (
    <div className="bestenberg-app" data-busy={state.busy ?? undefined}>
      <TopBar />
      <div className="bbe-body">
        <Structure />
        <main className="bestenberg-app__canvas">
          {state.post ? (
            <Canvas onShortcut={onShortcut} />
          ) : (
            <p className="bbe-welcome">
              {state.busy === 'loading' ? 'Opening…' : 'Choose a page in the bar above to edit it.'}
            </p>
          )}
        </main>
        <Inspector />
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Editor />
    </StoreProvider>
  );
}
