import { useEffect, useState } from '@wordpress/element';
import { openPost, save } from '../actions';
import { createPage, errorMessage, listPosts, settings, type PostSummary } from '../api';
import { AiDialog } from './AiDialog';
import { isDirty, useStore, type Scope, type Viewport } from '../store';

const VIEWPORTS: Array<{ value: Viewport; label: string }> = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'draft',
  pending: 'pending',
  private: 'private',
  future: 'scheduled',
};

function optionLabel(post: PostSummary): string {
  const title = post.title.trim() === '' ? `Untitled (#${post.id})` : post.title;
  const status = STATUS_LABEL[post.status];
  return status ? `${title} — ${status}` : title;
}

export function TopBar() {
  const { state, dispatch } = useStore();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const dirty = isDirty(state);
  const history = state.history;

  useEffect(() => {
    listPosts()
      .then(setPosts)
      .catch((error) =>
        dispatch({ type: 'failed', text: `Pages could not be listed. ${errorMessage(error)}` }),
      );
  }, [dispatch]);

  const confirmLeave = () =>
    !dirty || window.confirm('This page has unsaved changes. Leave without saving?');

  const choose = (key: string) => {
    if (key === '' || !confirmLeave()) return;
    if (key === 'new') {
      const title = window.prompt('Name of the new page');
      if (!title || title.trim() === '') return;
      dispatch({ type: 'loading' });
      createPage(title.trim())
        .then((page) => {
          setPosts((current) => [page, ...current]);
          return openPost(dispatch, page.rest, page.id);
        })
        .catch((error) =>
          dispatch({ type: 'failed', text: `The page was not created. ${errorMessage(error)}` }),
        );
      return;
    }
    const at = key.indexOf(':');
    const rest = key.slice(0, at);
    const id = key.slice(at + 1);
    if (at > 0 && id) void openPost(dispatch, rest, /^\d+$/.test(id) ? Number(id) : id);
  };

  const pages = posts.filter((post) => post.rest === 'pages');
  const articles = posts.filter((post) => post.rest === 'posts');
  const templates = posts.filter((post) => post.rest === 'templates');
  const parts = posts.filter((post) => post.rest === 'template-parts');
  const current = state.post ? `${state.post.rest}:${state.post.id}` : '';
  const known = posts.some((post) => `${post.rest}:${post.id}` === current);

  return (
    <header className="bestenberg-app__bar bbe-bar">
      <a
        className="bbe-bar__back"
        href={settings().adminUrl}
        aria-label="Back to WordPress"
        title="Back to WordPress"
        onClick={(event) => {
          if (!confirmLeave()) event.preventDefault();
        }}
      >
        ←
      </a>
      <h1 className="bestenberg-app__title">Bestenberg</h1>
      <select
        className="bbe-bar__page"
        aria-label="Page"
        value={current}
        onChange={(event) => choose(event.target.value)}
      >
        {current === '' && <option value="">Choose a page…</option>}
        {state.post && !known && <option value={current}>{optionLabel(state.post)}</option>}
        <optgroup label="Pages">
          {pages.map((post) => (
            <option key={post.id} value={`pages:${post.id}`}>
              {optionLabel(post)}
            </option>
          ))}
        </optgroup>
        {articles.length > 0 && (
          <optgroup label="Posts">
            {articles.map((post) => (
              <option key={post.id} value={`posts:${post.id}`}>
                {optionLabel(post)}
              </option>
            ))}
          </optgroup>
        )}
        {templates.length > 0 && (
          <optgroup label="Templates">
            {templates.map((post) => (
              <option key={post.id} value={`templates:${post.id}`}>
                {optionLabel(post)}
              </option>
            ))}
          </optgroup>
        )}
        {parts.length > 0 && (
          <optgroup label="Header and footer">
            {parts.map((post) => (
              <option key={post.id} value={`template-parts:${post.id}`}>
                {optionLabel(post)}
              </option>
            ))}
          </optgroup>
        )}
        <option value="new">New page…</option>
      </select>

      <div className="bbe-bar__center">
        <div className="bbe-segmented" role="group" aria-label="Preview size">
          {VIEWPORTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={state.viewport === value}
              onClick={() => dispatch({ type: 'viewport', viewport: value })}
            >
              {label}
            </button>
          ))}
        </div>
        {state.viewport !== 'mobile' && (
          <select
            aria-label="Style changes apply to"
            value={state.scope}
            onChange={(event) => dispatch({ type: 'scope', scope: event.target.value as Scope })}
          >
            <option value="all">Changes apply to all sizes</option>
            <option value="up">
              {state.viewport === 'tablet'
                ? 'Changes apply to tablet and up'
                : 'Changes apply to desktop only'}
            </option>
          </select>
        )}
      </div>

      <div className="bbe-bar__end">
        {generating && <AiDialog onClose={() => setGenerating(false)} />}
        {state.notice && (
          <span
            className={`bbe-notice bbe-notice--${state.notice.kind}`}
            role={state.notice.kind === 'error' ? 'alert' : 'status'}
          >
            {state.notice.text}
            {state.notice.kind === 'error' && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dispatch({ type: 'notice', notice: null })}
              >
                ✕
              </button>
            )}
          </span>
        )}
        <button
          type="button"
          className="bbe-button"
          disabled={!state.post || state.busy !== null}
          onClick={() => setGenerating(true)}
        >
          Generate
        </button>
        <button
          type="button"
          className="bbe-button bbe-button--quiet"
          disabled={!history || history.past.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
        >
          Undo
        </button>
        <button
          type="button"
          className="bbe-button bbe-button--quiet"
          disabled={!history || history.future.length === 0}
          onClick={() => dispatch({ type: 'redo' })}
        >
          Redo
        </button>
        {state.post && state.post.link !== '' && (
          <a
            className="bbe-button bbe-button--quiet"
            href={state.post.link}
            target="_blank"
            rel="noreferrer"
          >
            View page
          </a>
        )}
        <button
          type="button"
          className="bbe-button bbe-button--primary"
          disabled={!dirty || state.busy !== null}
          onClick={() => void save(state, dispatch)}
        >
          {state.busy === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </header>
  );
}
