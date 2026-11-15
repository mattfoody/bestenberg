declare module '*.css';

/*
 * Minimal types for the WordPress packages the editor uses. They are provided
 * at runtime as `wp.*` globals (dependency extraction), so they are not
 * installed; only the few calls Bestenberg makes are declared.
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

declare module '@wordpress/api-fetch' {
  export interface ApiFetchOptions {
    path?: string;
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: unknown;
    parse?: boolean;
  }
  export default function apiFetch<T = unknown>(options: ApiFetchOptions): Promise<T>;
}

/** Data printed by Bestenberg\Admin\EditorPage::settings(). */
interface BestenbergEditorSettings {
  version: string;
  postId: number;
  postRest: string;
  homeUrl: string;
  canvasNonce: string;
  canvasArg: string;
  canvasRoot: string;
  editorUrl: string;
  adminUrl: string;
  canDesign: boolean;
}

interface WpMediaAttachment {
  id: number;
  url: string;
  alt?: string;
}

interface WpMediaFrame {
  on(event: 'select', callback: () => void): void;
  open(): void;
  state(): { get(key: 'selection'): { first(): { toJSON(): WpMediaAttachment } } };
}

interface Window {
  bestenbergEditor?: BestenbergEditorSettings;
  wp?: {
    media?: (options: {
      title: string;
      multiple: boolean;
      library: { type: string };
      button: { text: string };
    }) => WpMediaFrame;
  };
}
