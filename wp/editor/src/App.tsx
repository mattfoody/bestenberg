import { useCallback, useEffect, useRef } from '@wordpress/element';
import { duplicate, openPost, remove, save } from './actions';
import { addDemoPages, errorMessage, settings } from './api';
import { Canvas } from './canvas/Canvas';
import { Inspector } from './panels/Inspector';
import { Structure } from './panels/Structure';
import { TopBar } from './panels/TopBar';
import { Welcome } from './panels/Welcome';
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
    if (postId !== 0 && postId !== '') void openPost(dispatch, postRest, postId);
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

  const addDemo = () => {
    dispatch({ type: 'loading' });
    addDemoPages()
      .then((id) => {
        // Reload so the page list includes the new pages.
        const url = new URL(settings().editorUrl);
        if (id > 0) url.searchParams.set('post', String(id));
        window.location.assign(url.toString());
      })
      .catch((error) =>
        dispatch({ type: 'failed', text: `The demo pages were not added. ${errorMessage(error)}` }),
      );
  };

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
    <div className="bestenberg-app" data-busy={state.busy ?? undefined} data-mode={state.mode}>
      <TopBar />
      <Welcome />
      <div className="bbe-body">
        <Structure />
        <main className="bestenberg-app__canvas">
          {state.post ? (
            <>
              <Canvas onShortcut={onShortcut} />
              {state.review && (
                <div className="bbe-review" role="status">
                  <span>
                    The AI added {state.review.sections}{' '}
                    {state.review.sections === 1 ? 'section' : 'sections'}. Nothing is saved yet.
                  </span>
                  <button
                    type="button"
                    className="bbe-button bbe-button--small"
                    onClick={() => dispatch({ type: 'undo' })}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="bbe-button bbe-button--small bbe-button--primary"
                    onClick={() => dispatch({ type: 'review-done' })}
                  >
                    Keep
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bbe-welcome">
              <p>
                {state.busy === 'loading'
                  ? 'Opening…'
                  : 'Choose a page in the bar above to edit it.'}
              </p>
              {state.busy === null && settings().canDesign && (
                <>
                  <p>New here? Start from a small example site: four pages you can restyle.</p>
                  <button type="button" className="bbe-button" onClick={addDemo}>
                    Add demo pages
                  </button>
                </>
              )}
            </div>
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
