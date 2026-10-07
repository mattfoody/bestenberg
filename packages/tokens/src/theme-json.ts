import { fontStack } from './css-variables';
import type { Tokens } from './load';

export interface TemplatePartArea {
  name: string;
  title: string;
  area: 'header' | 'footer' | 'uncategorized';
}

export interface ThemeJsonOptions {
  templateParts?: TemplatePartArea[];
  /** Container token used for `layout.contentSize`. */
  contentSize?: string;
  /** Container token used for `layout.wideSize`. */
  wideSize?: string;
}

const DEFAULT_TEMPLATE_PARTS: TemplatePartArea[] = [
  { name: 'header', title: 'Header', area: 'header' },
  { name: 'footer', title: 'Footer', area: 'footer' },
];

/** "on-primary" → "On primary", "sm" → "SM", "2xl" → "2XL". */
export function humanize(name: string): string {
  if (/^\d?[a-z]{1,2}$/.test(name)) return name.toUpperCase();
  const words = name.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function preset(category: string, slug: string): string {
  return `var(--wp--preset--${category}--${slug})`;
}

function pick(record: Record<string, string>, name: string, label: string): string {
  const value = record[name];
  if (value === undefined) throw new Error(`theme.json: unknown ${label} "${name}"`);
  return value;
}

/**
 * Builds theme.json (version 3) from tokens. Presets come from tokens and every
 * free-form value input is disabled, so the editor can only use tokens.
 */
export function generateThemeJson(tokens: Tokens, options: ThemeJsonOptions = {}) {
  const { templateParts = DEFAULT_TEMPLATE_PARTS, contentSize = 'md', wideSize = 'xl' } = options;

  const lineHeight = tokens.lineHeight.normal ?? Object.values(tokens.lineHeight)[0];

  return {
    $schema: 'https://schemas.wp.org/trunk/theme.json',
    version: 3,
    settings: {
      appearanceTools: false,
      useRootPaddingAwareAlignments: false,
      border: { color: false, radius: false, style: false, width: false },
      color: {
        custom: false,
        customDuotone: false,
        customGradient: false,
        defaultDuotone: false,
        defaultGradients: false,
        defaultPalette: false,
        duotone: [],
        gradients: [],
        palette: Object.entries(tokens.color).map(([slug, color]) => ({
          slug,
          name: humanize(slug),
          color,
        })),
      },
      layout: {
        contentSize: pick(tokens.container, contentSize, 'container'),
        wideSize: pick(tokens.container, wideSize, 'container'),
      },
      shadow: {
        defaultPresets: false,
        presets: Object.entries(tokens.shadow)
          .filter(([slug]) => slug !== 'none')
          .map(([slug, shadow]) => ({ slug, name: humanize(slug), shadow })),
      },
      spacing: {
        customSpacingSize: false,
        defaultSpacingSizes: false,
        margin: false,
        padding: false,
        units: [],
        spacingSizes: Object.entries(tokens.space).map(([slug, size]) => ({
          slug,
          name: slug,
          size,
        })),
      },
      typography: {
        customFontSize: false,
        defaultFontSizes: false,
        dropCap: false,
        fluid: true,
        fontStyle: false,
        letterSpacing: false,
        lineHeight: false,
        textDecoration: false,
        textTransform: false,
        writingMode: false,
        fontFamilies: Object.entries(tokens.fontFamily).map(([slug, families]) => ({
          slug,
          name: humanize(slug),
          fontFamily: fontStack(families),
        })),
        fontSizes: Object.entries(tokens.fontSize).map(([slug, { min, max }]) => ({
          slug,
          name: humanize(slug),
          size: max,
          fluid: { min, max },
        })),
      },
    },
    styles: {
      color: {
        background: preset('color', 'surface'),
        text: preset('color', 'on-surface'),
      },
      typography: {
        fontFamily: preset('font-family', 'sans'),
        fontSize: preset('font-size', 'base'),
        lineHeight: String(lineHeight),
      },
      elements: {
        link: { color: { text: preset('color', 'primary') } },
      },
    },
    templateParts,
  };
}
