/**
 * @bestenberg/adapter-blocks — schema ⇄ block markup.
 * Implemented in M2 (see TASKS.md 2.3–2.6).
 */

/** Block namespace for Bestenberg's own blocks. */
export const BLOCK_NAMESPACE = 'bestenberg' as const;

/** Builds a fully qualified Bestenberg block name, e.g. `bestenberg/section`. */
export function blockName(name: string): `${typeof BLOCK_NAMESPACE}/${string}` {
  return `${BLOCK_NAMESPACE}/${name}`;
}
