import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  CONTROL_GROUPS,
  createRegistry,
  defaultRegistry,
  defineComponent,
  heading,
  STYLE_KEYS,
  usesDisplay,
  V1_COMPONENTS,
  type ComponentDef,
  type ControlDef,
} from './index';

function pathProblem(def: ComponentDef, control: ControlDef): string | undefined {
  const [root, key] = control.path.split('.');
  switch (root) {
    case 'style':
      if (!STYLE_KEYS.includes(key as never)) return `unknown style key ${key}`;
      if (!def.styles.includes(key as never)) return `style "${key}" not allowed`;
      return undefined;
    case 'props':
      return key !== undefined && key in def.props.shape ? undefined : `unknown prop ${key}`;
    case 'hidden':
      return ['base', 'tablet', 'desktop'].includes(key ?? '')
        ? undefined
        : `bad hidden key ${key}`;
    case 'bind':
      return undefined;
    default:
      return `unknown path root ${root}`;
  }
}

describe('default registry', () => {
  it('registers the M1 components', () => {
    expect(defaultRegistry.list().map((c) => c.type)).toEqual([
      'section',
      'container',
      'stack',
      'row',
      'grid',
      'heading',
      'text',
      'button',
      'image',
    ]);
  });

  it('maps components to blocks both ways', () => {
    expect(defaultRegistry.get('text')?.block).toBe('core/paragraph');
    expect(defaultRegistry.forBlock('core/heading')?.type).toBe('heading');
    expect(defaultRegistry.forBlock('bestenberg/section')?.type).toBe('section');
    expect(defaultRegistry.forBlock('core/cover')).toBeUndefined();
  });

  it.each(V1_COMPONENTS.map((def) => [def.type, def] as const))(
    '%s: every control path resolves to an allowed field',
    (_type, def) => {
      for (const control of def.controls) {
        expect(
          pathProblem(def, control),
          `${def.type} → ${control.id} (${control.path})`,
        ).toBeUndefined();
      }
    },
  );

  it.each(V1_COMPONENTS.map((def) => [def.type, def] as const))(
    '%s: control ids are unique and groups are known',
    (_type, def) => {
      const ids = def.controls.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const control of def.controls) {
        expect(CONTROL_GROUPS.includes(control.group), control.id).toBe(true);
        if (control.kind === 'token') expect(control.token, control.id).toBeDefined();
      }
    },
  );

  it.each(V1_COMPONENTS.map((def) => [def.type, def] as const))(
    '%s: at most five quick controls',
    (_type, def) => {
      expect(def.controls.filter((c) => c.quick).length).toBeLessThanOrEqual(5);
    },
  );

  it('stack, row and grid imply their display and hide the switcher', () => {
    for (const type of ['stack', 'row', 'grid']) {
      const ids = defaultRegistry.get(type)!.controls.map((c) => c.id);
      expect(ids).not.toContain('layout.display');
    }
    expect(defaultRegistry.get('grid')!.controls.map((c) => c.id)).toContain('layout.columns');
  });

  it('shows columns on a section only when it uses grid', () => {
    const columns = defaultRegistry
      .get('section')!
      .controls.find((c) => c.id === 'layout.columns')!;
    const node = { id: 'abcd1234', type: 'section' };
    expect(columns.showIf!(node)).toBe(false);
    expect(
      columns.showIf!({ ...node, style: { base: {}, desktop: { layout: { display: 'grid' } } } }),
    ).toBe(true);
    expect(usesDisplay({ ...node, style: { base: { layout: { display: 'row' } } } }, 'row')).toBe(
      true,
    );
  });

  it('validates component props', () => {
    expect(heading.props.safeParse({ text: 'Hi', level: 2 }).success).toBe(true);
    expect(heading.props.safeParse({ text: 'Hi', level: 2, color: 'red' }).success).toBe(false);
  });
});

describe('createRegistry', () => {
  const def = (type: string, block: string) =>
    defineComponent({
      type,
      label: type,
      icon: type,
      category: 'content',
      block,
      props: z.strictObject({}),
      styles: [],
      allowedChildren: 'none',
      controls: [],
    });

  it('rejects duplicate types and blocks', () => {
    const registry = createRegistry([def('a', 'x/a')]);
    expect(() => registry.define(def('a', 'x/b'))).toThrow('already registered');
    expect(() => registry.define(def('b', 'x/a'))).toThrow('already used by component "a"');
    expect(registry.has('a')).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });
});
