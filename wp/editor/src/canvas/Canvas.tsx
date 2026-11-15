import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { renderNodes } from '@bestenberg/adapter-blocks';
import {
  findNode,
  isSafeUrl,
  sanitizeRichText,
  setControlValue,
  updateNode,
  walk,
  type Doc,
} from '@bestenberg/schema';
import { duplicate, nudge, registry, remove } from '../actions';
import { canvasUrl, renderMarkup, settings } from '../api';
import { currentDoc, useStore, type EditorState, type Viewport } from '../store';

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  mobile: '390px',
  tablet: '820px',
  desktop: '100%',
};

interface Editing {
  element: HTMLElement;
  id: string;
  prop: string;
  /** Whether this edit already has its undo step. */
  committed: boolean;
}

interface Box {
  top: number;
  left: number;
  width: number;
}

/** Browsers write <b>, <i> and <div> in editable text; map them to what rich text allows. */
export function normalizeEditable(html: string): string {
  return html
    .replace(/<(\/?)b(\s[^>]*)?>/gi, '<$1strong>')
    .replace(/<(\/?)i(\s[^>]*)?>/gi, '<$1em>')
    .replace(/<div><br\s*\/?><\/div>/gi, '<br>')
    .replace(/<(div|p)(\s[^>]*)?>/gi, '<br>')
    .replace(/<\/(div|p)>/gi, '')
    .replace(/&nbsp;/g, ' ');
}

interface Props {
  /** Keyboard shortcuts typed inside the canvas are handled by the app. */
  onShortcut: (event: KeyboardEvent) => void;
}

export function Canvas({ onShortcut }: Props) {
  const { state, dispatch } = useStore();
  const frame = useRef<HTMLIFrameElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const stateRef = useRef<EditorState>(state);
  stateRef.current = state;
  const shortcutRef = useRef(onShortcut);
  shortcutRef.current = onShortcut;
  const editing = useRef<Editing | null>(null);
  const rawHtml = useRef(new Map<string, string>());
  const [loaded, setLoaded] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  /** Link being added or changed in the text being edited (null = not linking). */
  const [link, setLink] = useState<{ url: string; existing: boolean } | null>(null);
  const linking = useRef<{ range: Range; anchor: HTMLAnchorElement | null } | null>(null);

  const doc = currentDoc(state);
  const postId = state.post?.id ?? null;
  const { selectedId, viewport } = state;

  const frameDocument = () => frame.current?.contentDocument ?? null;
  const canvasRoot = useCallback(
    () => frameDocument()?.getElementById(settings().canvasRoot) ?? null,
    [],
  );
  const elementFor = useCallback(
    (id: string) =>
      canvasRoot()?.querySelector<HTMLElement>(`[data-bb-id="${CSS.escape(id)}"]`) ?? null,
    [canvasRoot],
  );

  // ── Selection box (toolbar position) ──────────────────────────────────────

  const measure = useCallback(() => {
    const id = stateRef.current.selectedId;
    const element = id ? elementFor(id) : null;
    const iframe = frame.current;
    const host = wrapper.current;
    if (!element || !iframe || !host) {
      setBox(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    const frameRect = iframe.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    setBox({
      top: frameRect.top - hostRect.top + rect.top,
      left: frameRect.left - hostRect.left + Math.max(0, rect.left),
      width: rect.width,
    });
  }, [elementFor]);

  // ── Inline text editing ───────────────────────────────────────────────────

  const stopEditing = useCallback(() => {
    const current = editing.current;
    if (!current) return;
    editing.current = null;
    linking.current = null;
    setLink(null);
    current.element.removeAttribute('contenteditable');
    setIsEditing(false);
    // Re-render so the DOM matches the sanitized document again.
    setLoaded((n) => n + 1);
  }, []);

  const startEditing = useCallback(
    (element: HTMLElement) => {
      const owner = element.closest<HTMLElement>('[data-bb-id]');
      const id = owner?.getAttribute('data-bb-id');
      const prop = element.getAttribute('data-bb-text');
      if (!id || !prop) return;
      if (editing.current?.element === element) return;
      stopEditing();
      editing.current = { element, id, prop, committed: false };
      element.setAttribute('contenteditable', 'true');
      element.focus();
      setIsEditing(true);
      if (stateRef.current.selectedId !== id) dispatch({ type: 'select', id });
    },
    [dispatch, stopEditing],
  );

  const onInput = useCallback(() => {
    const current = editing.current;
    const document = currentDoc(stateRef.current);
    if (!current || !document) return;
    const text = sanitizeRichText(normalizeEditable(current.element.innerHTML));
    const optional = current.prop !== 'text';
    const next = updateNode(document, current.id, (node) =>
      setControlValue(
        node,
        { path: `props.${current.prop}` },
        optional && text === '' ? undefined : text,
      ),
    );
    dispatch({ type: current.committed ? 'replace' : 'commit', doc: next });
    current.committed = true;
  }, [dispatch]);

  // ── Canvas events (attached once per iframe load) ─────────────────────────

  const onLoad = useCallback(() => {
    const document = frameDocument();
    if (!document) return;
    if (!document.getElementById(settings().canvasRoot)) {
      dispatch({
        type: 'failed',
        text: 'The page preview could not load. Reload the editor, and check that the Bestenberg plugin is active.',
      });
      return;
    }

    let hovered: Element | null = null;
    const setHover = (element: Element | null) => {
      if (hovered === element) return;
      hovered?.removeAttribute('data-bb-hover');
      hovered = element;
      hovered?.setAttribute('data-bb-hover', '');
    };

    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element;
        if (target.closest('a, button, summary, label, input')) event.preventDefault();
        if (editing.current?.element.contains(target)) return;
        const element = target.closest<HTMLElement>('[data-bb-id]');
        const id = element?.getAttribute('data-bb-id') ?? null;
        const text = target.closest<HTMLElement>('[data-bb-text]');
        const textOwner = text?.closest('[data-bb-id]')?.getAttribute('data-bb-id');
        if (text && id !== null && textOwner === id && stateRef.current.selectedId === id) {
          startEditing(text);
          return;
        }
        stopEditing();
        dispatch({ type: 'select', id });
      },
      true,
    );
    document.addEventListener('dblclick', (event) => {
      const text = (event.target as Element).closest<HTMLElement>('[data-bb-text]');
      if (text) startEditing(text);
    });
    document.addEventListener('submit', (event) => event.preventDefault(), true);
    document.addEventListener('mouseover', (event) =>
      setHover((event.target as Element).closest('[data-bb-id]')),
    );
    document.addEventListener('mouseleave', () => setHover(null));
    document.addEventListener('input', onInput);
    document.addEventListener('focusout', (event) => {
      // Focus moves to the link field in the toolbar while a link is being edited.
      if (linking.current) return;
      if (editing.current && event.target === editing.current.element) stopEditing();
    });
    document.addEventListener('paste', (event) => {
      if (!editing.current) return;
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') ?? '';
      document.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' '));
    });
    document.addEventListener('keydown', (event) => {
      if (editing.current) {
        if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
          event.preventDefault();
          editing.current.element.blur();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          document.execCommand('insertLineBreak');
        }
        return;
      }
      shortcutRef.current(event);
    });
    document.defaultView?.addEventListener('scroll', measure, { passive: true });
    document.defaultView?.addEventListener('resize', measure);

    editing.current = null;
    setIsEditing(false);
    setLoaded((n) => n + 1);
  }, [dispatch, measure, onInput, startEditing, stopEditing]);

  // ── Rendering ─────────────────────────────────────────────────────────────

  const fillRaw = useCallback(
    (document: Doc) => {
      walk(document.root, (node) => {
        if (node.type !== 'raw' || typeof node.props?.markup !== 'string') return;
        const markup = node.props.markup;
        const place = (html: string) => {
          const element = elementFor(node.id);
          if (element?.classList.contains('bb-raw')) element.innerHTML = html;
        };
        const cached = rawHtml.current.get(markup);
        if (cached !== undefined) {
          place(cached);
          return;
        }
        renderMarkup(markup)
          .then((html) => {
            rawHtml.current.set(markup, html);
            place(html);
          })
          .catch(() => undefined);
      });
    },
    [elementFor],
  );

  useEffect(() => {
    const root = canvasRoot();
    if (!root || !doc || editing.current) return;
    root.innerHTML = renderNodes(doc.root, { editor: true, registry });
    fillRaw(doc);
  }, [doc, loaded, canvasRoot, fillRaw]);

  useEffect(() => {
    const root = canvasRoot();
    if (!root) return;
    root
      .querySelectorAll('[data-bb-selected]')
      .forEach((el) => el.removeAttribute('data-bb-selected'));
    const element = selectedId ? elementFor(selectedId) : null;
    element?.setAttribute('data-bb-selected', '');
    if (element && !editing.current) {
      const rect = element.getBoundingClientRect();
      const height = frame.current?.clientHeight ?? 0;
      if (rect.bottom < 0 || rect.top > height) element.scrollIntoView({ block: 'center' });
    }
    measure();
  }, [selectedId, doc, loaded, viewport, canvasRoot, elementFor, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const selected = doc && selectedId ? findNode(doc.root, selectedId) : null;
  const label = selected ? (registry.get(selected.node.type)?.label ?? selected.node.type) : '';
  const siblings = selected ? (selected.parent?.children ?? doc!.root).length : 0;
  const format = (command: 'bold' | 'italic') => frameDocument()?.execCommand(command);

  const startLink = () => {
    const selection = frameDocument()?.getSelection();
    const current = editing.current;
    if (!selection || selection.rangeCount === 0 || !current) return;
    const range = selection.getRangeAt(0);
    const start = range.startContainer;
    const anchor = (start instanceof Element ? start : start.parentElement)?.closest('a') ?? null;
    if (range.collapsed && !anchor) {
      dispatch({
        type: 'notice',
        notice: { kind: 'info', text: 'Select the words to link first.' },
      });
      return;
    }
    linking.current = { range: range.cloneRange(), anchor };
    setLink({ url: anchor?.getAttribute('href') ?? '', existing: anchor !== null });
  };

  /** Puts focus and the saved selection back in the text, then runs a link command. */
  const finishLink = (url: string | null) => {
    const saved = linking.current;
    const current = editing.current;
    const document = frameDocument();
    linking.current = null;
    setLink(null);
    if (!saved || !current || !document) return;
    current.element.focus();
    const selection = document.getSelection();
    if (!selection) return;
    const range = saved.range;
    if (saved.anchor) range.selectNodeContents(saved.anchor);
    selection.removeAllRanges();
    selection.addRange(range);
    if (url === null) return;
    if (url === '') document.execCommand('unlink');
    else document.execCommand('createLink', false, url);
  };
  const linkUrl = link?.url.trim() ?? '';
  const linkValid = linkUrl !== '' && isSafeUrl(linkUrl);
  // Keep focus (and the text selection) in the canvas when a toolbar button is pressed.
  const keepFocus = (event: { target: EventTarget; preventDefault(): void }) => {
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
  };

  if (postId === null) return <div className="bbe-canvas" ref={wrapper} />;

  return (
    <div className="bbe-canvas" ref={wrapper}>
      <iframe
        key={postId}
        ref={frame}
        className="bbe-canvas__frame"
        title="Page preview"
        src={canvasUrl(postId)}
        style={{ width: VIEWPORT_WIDTH[viewport] }}
        onLoad={onLoad}
      />
      {selected && box && (
        <div
          className="bbe-toolbar"
          role="toolbar"
          aria-label={`${label} actions`}
          style={{ top: Math.max(4, box.top - 36), left: Math.max(4, box.left) }}
          onMouseDown={keepFocus}
        >
          <span className="bbe-toolbar__label">{label}</span>
          {isEditing && link ? (
            <form
              className="bbe-toolbar__link"
              onSubmit={(event) => {
                event.preventDefault();
                if (linkValid) finishLink(linkUrl);
              }}
            >
              <input
                type="text"
                aria-label="Link address"
                placeholder="https://… or /page"
                value={link.url}
                autoFocus
                onChange={(event) => setLink({ ...link, url: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') finishLink(null);
                }}
              />
              <button
                type="submit"
                disabled={!linkValid}
                aria-label="Apply link"
                title="Apply link"
              >
                ✓
              </button>
              {link.existing && (
                <button
                  type="button"
                  onClick={() => finishLink('')}
                  aria-label="Remove link"
                  title="Remove link"
                >
                  ⌫
                </button>
              )}
              <button
                type="button"
                onClick={() => finishLink(null)}
                aria-label="Cancel"
                title="Cancel"
              >
                ✕
              </button>
            </form>
          ) : isEditing ? (
            <>
              <button type="button" onClick={() => format('bold')} aria-label="Bold" title="Bold">
                <strong>B</strong>
              </button>
              <button
                type="button"
                onClick={() => format('italic')}
                aria-label="Italic"
                title="Italic"
              >
                <em>I</em>
              </button>
              <button type="button" onClick={startLink} aria-label="Link" title="Link">
                <u>A</u>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={selected.index === 0}
                onClick={() => nudge(state, dispatch, selected.node.id, -1)}
                aria-label="Move earlier"
                title="Move earlier"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={selected.index >= siblings - 1}
                onClick={() => nudge(state, dispatch, selected.node.id, 1)}
                aria-label="Move later"
                title="Move later"
              >
                ↓
              </button>
              {selected.node.type !== 'raw' && (
                <button
                  type="button"
                  onClick={() => duplicate(state, dispatch, selected.node.id)}
                  aria-label="Duplicate"
                  title="Duplicate"
                >
                  ⧉
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(state, dispatch, selected.node.id)}
                aria-label="Delete"
                title="Delete"
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
