import type { ComponentDef } from './types';

export interface Registry {
  define(def: ComponentDef): ComponentDef;
  get(type: string): ComponentDef | undefined;
  has(type: string): boolean;
  list(): ComponentDef[];
  /** Component stored by a given block name (`core/heading` → heading). */
  forBlock(blockName: string): ComponentDef | undefined;
}

/** Identity helper that type-checks a component definition. */
export function defineComponent(def: ComponentDef): ComponentDef {
  return def;
}

/** A new, empty registry. Throws on duplicate types or blocks. */
export function createRegistry(defs: ComponentDef[] = []): Registry {
  const byType = new Map<string, ComponentDef>();
  const byBlock = new Map<string, ComponentDef>();

  const registry: Registry = {
    define(def) {
      if (byType.has(def.type)) throw new Error(`Component "${def.type}" is already registered`);
      const owner = byBlock.get(def.block);
      if (owner) {
        throw new Error(`Block "${def.block}" is already used by component "${owner.type}"`);
      }
      byType.set(def.type, def);
      byBlock.set(def.block, def);
      return def;
    },
    get: (type) => byType.get(type),
    has: (type) => byType.has(type),
    list: () => [...byType.values()],
    forBlock: (blockName) => byBlock.get(blockName),
  };

  defs.forEach((def) => registry.define(def));
  return registry;
}
