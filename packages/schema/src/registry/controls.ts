import { ALIGN, BORDER_WIDTHS, CONTAINER_NAMES, JUSTIFY, TEXT_ALIGN } from '@bestenberg/tokens';
import type { Node } from '../document';
import { BREAKPOINTS } from '../style';
import type { ControlDef, ControlOption } from './types';

const options = (values: readonly (string | number)[], label = (v: string) => v): ControlOption[] =>
  values.map((value) => ({ value, label: label(String(value)) }));

const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** True when any breakpoint sets layout.display to `display`. */
export function usesDisplay(node: Node, display: 'stack' | 'row' | 'grid'): boolean {
  return BREAKPOINTS.some((bp) => node.style?.[bp]?.layout?.display === display);
}

export interface LayoutControlOptions {
  /** Include the display switcher (off for stack/row/grid, whose type implies it). */
  display?: boolean;
  columns?: boolean;
  wrap?: boolean;
}

export function layoutControls({
  display = true,
  columns = true,
  wrap = true,
}: LayoutControlOptions = {}): ControlDef[] {
  const list: ControlDef[] = [];
  if (display) {
    list.push({
      id: 'layout.display',
      group: 'layout',
      label: 'Layout',
      kind: 'segmented',
      path: 'style.layout.display',
      options: options(['stack', 'row', 'grid'], title),
      responsive: true,
      quick: true,
    });
  }
  if (columns) {
    list.push({
      id: 'layout.columns',
      group: 'layout',
      label: 'Columns',
      kind: 'columns',
      path: 'style.layout.columns',
      responsive: true,
      ...(display ? { showIf: (node: Node) => usesDisplay(node, 'grid') } : {}),
    });
  }
  list.push(
    {
      id: 'layout.gap',
      group: 'layout',
      label: 'Gap',
      kind: 'token',
      token: 'space',
      path: 'style.layout.gap',
      responsive: true,
    },
    {
      id: 'layout.align',
      group: 'layout',
      label: 'Align',
      kind: 'segmented',
      path: 'style.layout.align',
      options: options(Object.keys(ALIGN), title),
      responsive: true,
    },
    {
      id: 'layout.justify',
      group: 'layout',
      label: 'Justify',
      kind: 'segmented',
      path: 'style.layout.justify',
      options: options(Object.keys(JUSTIFY), title),
      responsive: true,
    },
  );
  if (wrap) {
    list.push({
      id: 'layout.wrap',
      group: 'layout',
      label: 'Wrap',
      kind: 'toggle',
      path: 'style.layout.wrap',
      responsive: true,
    });
  }
  return list;
}

export function widthControls(): ControlDef[] {
  return [
    {
      id: 'width',
      group: 'layout',
      label: 'Width',
      kind: 'select',
      path: 'style.width',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'full', label: 'Full' },
        ...CONTAINER_NAMES.map((name) => ({
          value: `container.${name}`,
          label: name.toUpperCase(),
        })),
      ],
      responsive: true,
    },
  ];
}

export function spacingControls({ margin = true }: { margin?: boolean } = {}): ControlDef[] {
  const token = (id: string, label: string, path: string, quick = false): ControlDef => ({
    id,
    group: 'spacing',
    label,
    kind: 'token',
    token: 'space',
    path,
    responsive: true,
    ...(quick ? { quick } : {}),
  });
  const list = [
    token('padding.y', 'Padding vertical', 'style.padding.y', true),
    token('padding.x', 'Padding horizontal', 'style.padding.x'),
  ];
  if (margin) {
    list.push(
      token('margin.top', 'Margin top', 'style.margin.top'),
      token('margin.bottom', 'Margin bottom', 'style.margin.bottom'),
    );
  }
  return list;
}

/** Margin only (for text-level components). */
export function marginControls(): ControlDef[] {
  return spacingControls().filter((control) => control.id.startsWith('margin.'));
}

export function typographyControls(): ControlDef[] {
  return [
    {
      id: 'font.size',
      group: 'typography',
      label: 'Size',
      kind: 'token',
      token: 'fontSize',
      path: 'style.font.size',
      responsive: true,
      quick: true,
    },
    {
      id: 'font.weight',
      group: 'typography',
      label: 'Weight',
      kind: 'token',
      token: 'fontWeight',
      path: 'style.font.weight',
    },
    {
      id: 'font.family',
      group: 'typography',
      label: 'Font',
      kind: 'token',
      token: 'fontFamily',
      path: 'style.font.family',
    },
    {
      id: 'font.lineHeight',
      group: 'typography',
      label: 'Line height',
      kind: 'token',
      token: 'lineHeight',
      path: 'style.font.lineHeight',
    },
    {
      id: 'font.align',
      group: 'typography',
      label: 'Align',
      kind: 'segmented',
      path: 'style.font.align',
      options: options(TEXT_ALIGN, title),
      responsive: true,
      quick: true,
    },
  ];
}

export function colorControls({ background = true }: { background?: boolean } = {}): ControlDef[] {
  const list: ControlDef[] = [
    {
      id: 'color',
      group: 'color',
      label: 'Text',
      kind: 'token',
      token: 'color',
      path: 'style.color',
    },
  ];
  if (background) {
    list.push({
      id: 'background',
      group: 'color',
      label: 'Background',
      kind: 'token',
      token: 'color',
      path: 'style.background',
      quick: true,
    });
  }
  return list;
}

export function effectsControls({ aspect = false }: { aspect?: boolean } = {}): ControlDef[] {
  const list: ControlDef[] = [
    {
      id: 'radius',
      group: 'effects',
      label: 'Radius',
      kind: 'token',
      token: 'radius',
      path: 'style.radius',
    },
    {
      id: 'shadow',
      group: 'effects',
      label: 'Shadow',
      kind: 'token',
      token: 'shadow',
      path: 'style.shadow',
    },
    {
      id: 'border.width',
      group: 'effects',
      label: 'Border',
      kind: 'segmented',
      path: 'style.border.width',
      options: options(BORDER_WIDTHS, (v) => (v === '0' ? 'None' : `${v}px`)),
    },
    {
      id: 'border.color',
      group: 'effects',
      label: 'Border color',
      kind: 'token',
      token: 'color',
      path: 'style.border.color',
    },
  ];
  if (aspect) {
    list.push({
      id: 'aspect',
      group: 'effects',
      label: 'Aspect ratio',
      kind: 'select',
      path: 'style.aspect',
      options: options(['auto', '1/1', '4/3', '3/4', '16/9']),
      responsive: true,
    });
  }
  return list;
}

export function visibilityControls(): ControlDef[] {
  return [
    {
      id: 'hidden.base',
      group: 'visibility',
      label: 'Hide on mobile',
      kind: 'toggle',
      path: 'hidden.base',
    },
    {
      id: 'hidden.tablet',
      group: 'visibility',
      label: 'Hide on tablet',
      kind: 'toggle',
      path: 'hidden.tablet',
    },
    {
      id: 'hidden.desktop',
      group: 'visibility',
      label: 'Hide on desktop',
      kind: 'toggle',
      path: 'hidden.desktop',
    },
  ];
}
