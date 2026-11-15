import { useState } from '@wordpress/element';
import type { DragEvent } from 'react';
import { DYNAMIC_BLOCKS, DYNAMIC_GROUPS, DYNAMIC_GROUP_LABELS } from '@bestenberg/adapter-blocks';
import {
  PATTERNS,
  PATTERN_CATEGORIES,
  PATTERN_CATEGORY_LABELS,
  canMove,
  findNode,
  insertPlacement,
  type Doc,
  type Node,
} from '@bestenberg/schema';
import { insert, insertDynamic, insertPattern, move, registry } from '../actions';
import { settings } from '../api';
import { currentDoc, useStore } from '../store';

type DropPosition = 'before' | 'inside' | 'after';

interface DropTarget {
  id: string;
  position: DropPosition;
}

const DRAG_TYPE = 'application/x-bestenberg-node';

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Short description of a node's content for the tree row. */
export function nodeSummary(node: Node): string {
  const props = node.props ?? {};
  if (typeof props.text === 'string') return plainText(props.text);
  if (typeof props.alt === 'string' && props.alt !== '') return props.alt;
  if (node.type === 'raw' && typeof props.name === 'string') {
    const known = DYNAMIC_BLOCKS.find((block) => block.markup === props.markup);
    return known ? known.label : props.name;
  }
  return '';
}

function acceptsChildren(node: Node): boolean {
  const def = registry.get(node.type);
  return def !== undefined && def.allowedChildren !== 'none';
}

/** Where a drop lands, or null if the node may not go there. */
function resolveDrop(
  doc: Doc,
  draggedId: string,
  target: DropTarget,
): { parentId: string | null; index: number } | null {
  const found = findNode(doc.root, target.id);
  if (!found || target.id === draggedId) return null;
  if (target.position === 'inside') {
    if (!canMove(doc, registry, draggedId, target.id)) return null;
    return { parentId: target.id, index: found.node.children?.length ?? 0 };
  }
  const parentId = found.parent?.id ?? null;
  if (!canMove(doc, registry, draggedId, parentId)) return null;
  return { parentId, index: target.position === 'before' ? found.index : found.index + 1 };
}

export function Structure() {
  const { state, dispatch } = useStore();
  const doc = currentDoc(state);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<'sections' | 'components' | 'data'>('sections');

  if (!doc) return <aside className="bbe-panel bbe-structure" aria-label="Page structure" />;

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onDragOver = (event: DragEvent<HTMLElement>, node: Node) => {
    if (!dragged) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const inside = acceptsChildren(node);
    let position: DropPosition = ratio < 0.5 ? 'before' : 'after';
    if (inside && ratio > 0.3 && ratio < 0.7) position = 'inside';
    const target = { id: node.id, position };
    if (!resolveDrop(doc, dragged, target)) {
      if (drop) setDrop(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (drop?.id !== target.id || drop.position !== position) setDrop(target);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const place = dragged && drop ? resolveDrop(doc, dragged, drop) : null;
    if (dragged && place) move(state, dispatch, dragged, place.parentId, place.index);
    setDragged(null);
    setDrop(null);
  };

  const row = (node: Node, depth: number) => {
    const def = registry.get(node.type);
    const children = node.children ?? [];
    const open = !collapsed.has(node.id);
    const summary = nodeSummary(node);
    const classes = ['bbe-tree__row'];
    if (state.selectedId === node.id) classes.push('is-selected');
    if (dragged === node.id) classes.push('is-dragged');
    if (drop?.id === node.id) classes.push(`is-drop-${drop.position}`);
    return (
      <li key={node.id} role="treeitem" aria-selected={state.selectedId === node.id}>
        <div
          className={classes.join(' ')}
          style={{ paddingLeft: 8 + depth * 14 }}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_TYPE, node.id);
            event.dataTransfer.effectAllowed = 'move';
            setDragged(node.id);
          }}
          onDragEnd={() => {
            setDragged(null);
            setDrop(null);
          }}
          onDragOver={(event) => onDragOver(event, node)}
          onDrop={onDrop}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className="bbe-tree__twist"
              aria-label={open ? 'Collapse' : 'Expand'}
              aria-expanded={open}
              onClick={() => toggle(node.id)}
            >
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className="bbe-tree__twist" />
          )}
          <button
            type="button"
            className="bbe-tree__name"
            data-node={node.id}
            onClick={() => dispatch({ type: 'select', id: node.id })}
          >
            <span className="bbe-tree__type">{def?.label ?? node.type}</span>
            {summary !== '' && <span className="bbe-tree__summary">{summary}</span>}
          </button>
        </div>
        {children.length > 0 && open && (
          <ul role="group">{children.map((child) => row(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const selected = state.selectedId ? findNode(doc.root, state.selectedId)?.node : null;
  const choices = registry
    .list()
    .filter((def) => !def.internal && insertPlacement(doc, registry, state.selectedId, def.type));
  const categories = [...new Set(choices.map((def) => def.category))];

  return (
    <aside className="bbe-panel bbe-structure" aria-label="Page structure">
      <div className="bbe-panel__head">
        <h2>Structure</h2>
        <button
          type="button"
          className="bbe-button bbe-button--small"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          {adding ? 'Close' : 'Add'}
        </button>
      </div>
      {adding && (
        <div className="bbe-inserter">
          <div className="bbe-segmented" role="group" aria-label="What to add">
            <button
              type="button"
              aria-pressed={tab === 'sections'}
              onClick={() => setTab('sections')}
            >
              Sections
            </button>
            <button
              type="button"
              aria-pressed={tab === 'components'}
              onClick={() => setTab('components')}
            >
              Components
            </button>
            <button type="button" aria-pressed={tab === 'data'} onClick={() => setTab('data')}>
              Site data
            </button>
          </div>
          {tab === 'sections' ? (
            <>
              <p className="bbe-inserter__where">
                {selected ? 'Adds below the selected section.' : 'Adds to the end of the page.'}
              </p>
              {PATTERN_CATEGORIES.map((category) => {
                const items = PATTERNS.filter((pattern) => pattern.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category} className="bbe-inserter__group">
                    <h3>{PATTERN_CATEGORY_LABELS[category]}</h3>
                    <div className="bbe-inserter__patterns">
                      {items.map((pattern) => (
                        <button
                          key={pattern.id}
                          type="button"
                          data-pattern={pattern.id}
                          onClick={() => insertPattern(state, dispatch, pattern.id)}
                        >
                          <strong>{pattern.label}</strong>
                          <span>{pattern.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : tab === 'data' ? (
            <>
              <p className="bbe-inserter__where">
                Shows live content from WordPress{settings().hasStore ? ' and your store' : ''}.
                Text and settings of these are managed in WordPress.
              </p>
              {DYNAMIC_GROUPS.map((group) => {
                const items = DYNAMIC_BLOCKS.filter(
                  (block) =>
                    block.group === group &&
                    (block.requires !== 'woocommerce' || settings().hasStore),
                );
                if (items.length === 0) return null;
                return (
                  <div key={group} className="bbe-inserter__group">
                    <h3>{DYNAMIC_GROUP_LABELS[group]}</h3>
                    <div className="bbe-inserter__patterns">
                      {items.map((block) => (
                        <button
                          key={block.id}
                          type="button"
                          data-dynamic={block.id}
                          onClick={() => insertDynamic(state, dispatch, block.id)}
                        >
                          <strong>{block.label}</strong>
                          <span>{block.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <p className="bbe-inserter__where">
                {selected
                  ? `Adds to or after the selected ${(registry.get(selected.type)?.label ?? selected.type).toLowerCase()}.`
                  : 'Adds to the end of the page.'}
              </p>
              {categories.map((category) => (
                <div key={category} className="bbe-inserter__group">
                  <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                  <div className="bbe-inserter__items">
                    {choices
                      .filter((def) => def.category === category)
                      .map((def) => (
                        <button
                          key={def.type}
                          type="button"
                          data-insert={def.type}
                          onClick={() => insert(state, dispatch, def.type)}
                        >
                          {def.label}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {doc.root.length === 0 ? (
        <p className="bbe-panel__empty">
          Nothing here yet. Choose Add to start with a ready-made section.
        </p>
      ) : (
        <ul className="bbe-tree" role="tree" aria-label="Page structure">
          {doc.root.map((node) => row(node, 0))}
        </ul>
      )}
    </aside>
  );
}
