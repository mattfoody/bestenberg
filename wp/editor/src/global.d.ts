declare module '*.css';

/*
 * Minimal types for the WordPress packages used so far. They are provided at
 * runtime as `wp.*` globals (dependency extraction), so they are not installed.
 * Replace with the real type packages when the editor grows (M3).
 */
declare module '@wordpress/blocks' {
  export function registerBlockType(metadata: object, settings: object): unknown;
}

declare module '@wordpress/block-editor' {
  export function useBlockProps(props?: object): Record<string, unknown>;
  export function useInnerBlocksProps(props?: object): Record<string, unknown>;
  export const InnerBlocks: { Content: import('react').ComponentType };
}

declare module '@wordpress/hooks' {
  export function addFilter<T>(
    hookName: string,
    namespace: string,
    callback: (value: T, ...args: never[]) => T,
  ): void;
}
