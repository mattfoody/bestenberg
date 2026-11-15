import { useEffect, useRef, useState } from '@wordpress/element';
import {
  CONTROL_GROUPS,
  getControlValue,
  isSafeUrl,
  resolveControlValue,
  setControlValue,
  updateNode,
  type Breakpoint,
  type ControlDef,
  type ControlGroup,
  type Node,
} from '@bestenberg/schema';
import { GRID_COLUMNS, tokens, type TokenCategory } from '@bestenberg/tokens';
import { registry } from '../actions';
import {
  VIEWPORT_BREAKPOINT,
  currentDoc,
  selectedNode,
  targetBreakpoint,
  useStore,
} from '../store';

const GROUP_LABEL: Record<ControlGroup, string> = {
  content: 'Content',
  layout: 'Layout',
  spacing: 'Spacing',
  typography: 'Text',
  color: 'Colour',
  effects: 'Border and shadow',
  visibility: 'Visibility',
  data: 'Data',
};

const BREAKPOINT_LABEL: Record<Breakpoint, string> = {
  base: 'all sizes',
  tablet: 'tablet and up',
  desktop: 'desktop',
};

/** Human label for a token name: `on-primary` → `On primary`, `4` → `4 · 1rem`. */
function tokenLabel(category: TokenCategory, name: string): string {
  const value = tokens[category][name];
  if (category === 'space' || category === 'radius' || category === 'container') {
    return `${name} · ${String(value)}`;
  }
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

interface FieldProps {
  control: ControlDef;
  /** Value in effect at the current viewport (may be inherited). */
  value: unknown;
  /** Writes the value. `typing` groups consecutive keystrokes into one undo step. */
  onChange: (value: unknown, typing?: boolean) => void;
  node: Node;
}

function TokenField({ control, value, onChange }: FieldProps) {
  const category = control.token!;
  const names = Object.keys(tokens[category]);
  const current = typeof value === 'string' ? value : '';
  if (category === 'color') {
    return (
      <div className="bbe-swatches" role="group" aria-label={control.label}>
        {names.map((name) => {
          const ref = `color.${name}`;
          return (
            <button
              key={name}
              type="button"
              className="bbe-swatch"
              aria-pressed={current === ref}
              aria-label={tokenLabel(category, name)}
              title={tokenLabel(category, name)}
              style={{ background: tokens.color[name] }}
              onClick={() => onChange(current === ref ? undefined : ref)}
            />
          );
        })}
      </div>
    );
  }
  return (
    <select
      aria-label={control.label}
      value={current}
      onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
    >
      <option value="">Default</option>
      {names.map((name) => (
        <option key={name} value={`${category}.${name}`}>
          {tokenLabel(category, name)}
        </option>
      ))}
    </select>
  );
}

function SegmentedField({ control, value, onChange }: FieldProps) {
  const options =
    control.kind === 'columns'
      ? GRID_COLUMNS.map((n) => ({ value: n as unknown, label: String(n) }))
      : (control.options ?? []);
  return (
    <div className="bbe-segmented" role="group" aria-label={control.label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(value === option.value ? undefined : option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SelectField({ control, value, onChange }: FieldProps) {
  const options = control.options ?? [];
  const index = options.findIndex((option) => option.value === value);
  return (
    <select
      aria-label={control.label}
      value={index === -1 ? '' : String(index)}
      onChange={(event) =>
        onChange(event.target.value === '' ? undefined : options[Number(event.target.value)]?.value)
      }
    >
      <option value="">Default</option>
      {options.map((option, i) => (
        <option key={String(option.value)} value={String(i)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ToggleField({ control, value, onChange }: FieldProps) {
  const on = control.options?.[0]?.value ?? true;
  const checked = value === on;
  return (
    <button
      type="button"
      role="switch"
      className="bbe-switch"
      aria-checked={checked}
      aria-label={control.label}
      onClick={() => onChange(checked ? undefined : on)}
    >
      <span />
    </button>
  );
}

function TextField({ control, value, onChange }: FieldProps) {
  const isLink = control.kind === 'link';
  const stored = typeof value === 'string' ? value : '';
  const [draft, setDraft] = useState(stored);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(stored);
  }, [stored]);
  const invalid = isLink && draft.trim() !== '' && !isSafeUrl(draft.trim());
  return (
    <>
      <input
        type={isLink ? 'url' : 'text'}
        aria-label={control.label}
        aria-invalid={invalid}
        placeholder={isLink ? 'https://… or /page' : ''}
        value={draft}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setDraft(stored);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const clean = isLink ? next.trim() : next;
          if (isLink && clean !== '' && !isSafeUrl(clean)) return;
          // Alt text is required (may be empty); other text clears when empty.
          const keepEmpty = control.path === 'props.alt';
          onChange(clean === '' && !keepEmpty ? undefined : clean, true);
        }}
      />
      {invalid && (
        <p className="bbe-field__error">Use a web address, a /path, mailto: or tel: link.</p>
      )}
    </>
  );
}

/** What the media library hands back; null removes the image. */
interface PickedImage {
  url: string;
  id: number;
  alt: string;
}

/** The image address a media control currently holds (image src or background image). */
function mediaUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'image' in value) {
    const image = (value as { image?: { url?: unknown } }).image;
    return typeof image?.url === 'string' ? image.url : '';
  }
  return '';
}

function MediaField({ control, value, onChange }: FieldProps) {
  const src = mediaUrl(value);
  const choose = () => {
    const media = window.wp?.media;
    if (!media) return;
    const frame = media({
      title: 'Choose an image',
      multiple: false,
      library: { type: 'image' },
      button: { text: 'Use image' },
    });
    frame.on('select', () => {
      const picked = frame.state().get('selection').first().toJSON();
      const image: PickedImage = { url: picked.url, id: picked.id, alt: picked.alt ?? '' };
      onChange(image);
    });
    frame.open();
  };
  return (
    <div className="bbe-media" role="group" aria-label={control.label}>
      {src !== '' && <img src={src} alt="" />}
      <div className="bbe-media__actions">
        <button type="button" className="bbe-button bbe-button--small" onClick={choose}>
          {src === '' ? 'Choose image' : 'Replace'}
        </button>
        {src !== '' && (
          <button
            type="button"
            className="bbe-button bbe-button--small bbe-button--quiet"
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/** Applies a media library choice to an image component or a background. */
function applyImage(node: Node, control: ControlDef, picked: PickedImage | null): Node {
  if (control.path === 'style.background') {
    const current = node.style?.base?.background;
    const overlay = typeof current === 'object' ? current.overlay : undefined;
    const background = picked
      ? { image: { url: picked.url, id: picked.id }, ...(overlay ? { overlay } : {}) }
      : undefined;
    return setControlValue(node, control, background);
  }
  // Image component: address, library id and alt text travel together.
  let next = setControlValue(node, control, picked?.url ?? '');
  next = setControlValue(next, { path: 'props.mediaId' }, picked?.id);
  if (picked && picked.alt !== '' && !node.props?.alt) {
    next = setControlValue(next, { path: 'props.alt' }, picked.alt);
  }
  return next;
}

function fieldFor(control: ControlDef) {
  switch (control.kind) {
    case 'token':
      return TokenField;
    case 'segmented':
    case 'columns':
      return SegmentedField;
    case 'select':
      return SelectField;
    case 'toggle':
      return ToggleField;
    case 'text':
    case 'link':
      return TextField;
    case 'media':
      return MediaField;
    default:
      return null;
  }
}

export function Inspector() {
  const { state, dispatch } = useStore();
  const node = selectedNode(state);
  const typing = useRef<string | null>(null);

  // A new selection starts a new undo step for typed values.
  useEffect(() => {
    typing.current = null;
  }, [state.selectedId]);

  if (!node) {
    return (
      <aside className="bbe-panel bbe-inspector" aria-label="Settings">
        <p className="bbe-panel__empty">
          {currentDoc(state)
            ? 'Select something on the page to change it.'
            : 'Open a page to start editing.'}
        </p>
      </aside>
    );
  }

  const def = registry.get(node.type);
  const viewBreakpoint = VIEWPORT_BREAKPOINT[state.viewport];
  const writeBreakpoint = targetBreakpoint(state);
  const controls = (def?.controls ?? []).filter(
    (control) => fieldFor(control) !== null && (control.showIf?.(node) ?? true),
  );
  const hasInlineText = (def?.controls ?? []).some((control) => control.kind === 'richtext');

  const write = (control: ControlDef, value: unknown, isTyping = false) => {
    const doc = currentDoc(state);
    if (!doc) return;
    const next = updateNode(doc, node.id, (current) => {
      if (control.kind === 'media')
        return applyImage(current, control, value as PickedImage | null);
      return setControlValue(current, control, value, writeBreakpoint);
    });
    const continuing = isTyping && typing.current === control.id;
    dispatch({ type: continuing ? 'replace' : 'commit', doc: next });
    typing.current = isTyping ? control.id : null;
  };

  return (
    <aside className="bbe-panel bbe-inspector" aria-label="Settings">
      <div className="bbe-panel__head">
        <h2>{def?.label ?? node.type}</h2>
      </div>
      {node.type === 'raw' && (
        <p className="bbe-panel__empty">
          This block comes from WordPress or another plugin. Bestenberg keeps it exactly as it is;
          you can move or delete it here and edit it in the WordPress editor.
        </p>
      )}
      {hasInlineText && (
        <p className="bbe-inspector__hint">Click the text on the page to edit it.</p>
      )}
      {CONTROL_GROUPS.map((group) => {
        const items = controls.filter((control) => control.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="bbe-group">
            <h3>{GROUP_LABEL[group]}</h3>
            {items.map((control) => {
              const Field = fieldFor(control)!;
              const resolved = resolveControlValue(node, control, viewBreakpoint);
              const own = getControlValue(node, control, writeBreakpoint);
              const inherited =
                control.responsive && resolved.from !== null && resolved.from !== writeBreakpoint;
              const inline = control.kind === 'toggle';
              return (
                <div
                  key={control.id}
                  className={`bbe-field${inline ? ' bbe-field--inline' : ''}`}
                  data-control={control.id}
                >
                  <div className="bbe-field__label">
                    <span>{control.label}</span>
                    {inherited && (
                      <span className="bbe-field__from">
                        from {BREAKPOINT_LABEL[resolved.from!]}
                      </span>
                    )}
                    {control.responsive && own !== undefined && writeBreakpoint !== 'base' && (
                      <button
                        type="button"
                        className="bbe-field__reset"
                        onClick={() => write(control, undefined)}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <Field
                    control={control}
                    value={resolved.value}
                    node={node}
                    onChange={(value, isTyping) => write(control, value, isTyping)}
                  />
                </div>
              );
            })}
          </section>
        );
      })}
    </aside>
  );
}
