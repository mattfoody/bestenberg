import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_NAME_LISTS,
  cssVar,
  cssVarName,
  fluidClamp,
  fontStack,
  generateCssVariables,
  generateThemeJson,
  humanize,
  phpReturnFile,
  tokens,
  toPhp,
} from './index';
import { TOKEN_CATEGORIES } from './load';

const repoFile = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

describe('fluidClamp', () => {
  it('scales from min at 320px to max at 1280px', () => {
    // slope = 0.0625 / 60 rem per rem of viewport; intercept = 1 - slope * 20
    expect(fluidClamp({ min: '1rem', max: '1.0625rem' })).toBe(
      'clamp(1rem, 0.9792rem + 0.1042vw, 1.0625rem)',
    );
  });

  it('returns the plain value when min equals max', () => {
    expect(fluidClamp({ min: '1rem', max: '1rem' })).toBe('1rem');
  });

  it('accepts px input', () => {
    expect(fluidClamp({ min: '16px', max: '24px' })).toBe(
      'clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)',
    );
  });
});

describe('CSS variables', () => {
  const css = generateCssVariables(tokens);

  it('names variables --bb-{category}-{name}', () => {
    expect(cssVarName('fontSize', '2xl')).toBe('--bb-font-size-2xl');
    expect(cssVar('space', '4')).toBe('var(--bb-space-4)');
  });

  it('emits one variable per token, except breakpoints', () => {
    expect(css).toMatch('--bb-space-4: 1rem;');
    expect(css).toMatch('--bb-color-on-primary: #ffffff;');
    expect(css).toMatch('--bb-font-weight-bold: 700;');
    expect(css).toMatch(/--bb-font-size-base: clamp\(/);
    expect(css).not.toMatch('breakpoint');
  });

  it('quotes font family names that contain spaces', () => {
    expect(fontStack(['Segoe UI', 'Arial'])).toBe('"Segoe UI", Arial');
  });

  it('matches the committed variables.css', () => {
    expect(repoFile('wp/plugin/generated/variables.css')).toBe(css);
  });
});

describe('theme.json', () => {
  const theme = generateThemeJson(tokens);

  it('disables free-form values', () => {
    expect(theme.settings.color.custom).toBe(false);
    expect(theme.settings.color.customGradient).toBe(false);
    expect(theme.settings.color.defaultPalette).toBe(false);
    expect(theme.settings.spacing.customSpacingSize).toBe(false);
    expect(theme.settings.spacing.units).toEqual([]);
    expect(theme.settings.spacing.padding).toBe(false);
    expect(theme.settings.spacing.margin).toBe(false);
    expect(theme.settings.typography.customFontSize).toBe(false);
    expect(theme.settings.typography.lineHeight).toBe(false);
  });

  it('builds presets from tokens', () => {
    expect(theme.settings.color.palette).toHaveLength(Object.keys(tokens.color).length);
    expect(theme.settings.spacing.spacingSizes[4]).toEqual({ slug: '4', name: '4', size: '1rem' });
    expect(theme.settings.typography.fontSizes[2]).toEqual({
      slug: 'base',
      name: 'Base',
      size: '1.0625rem',
      fluid: { min: '1rem', max: '1.0625rem' },
    });
    expect(theme.settings.shadow.presets.map((p) => p.slug)).not.toContain('none');
  });

  it('takes layout sizes from container tokens', () => {
    expect(theme.settings.layout).toEqual({ contentSize: '48rem', wideSize: '80rem' });
    expect(() => generateThemeJson(tokens, { contentSize: 'huge' })).toThrow('unknown container');
  });

  it('humanizes preset names', () => {
    expect(humanize('on-primary')).toBe('On primary');
    expect(humanize('sm')).toBe('SM');
    expect(humanize('2xl')).toBe('2XL');
    expect(humanize('base')).toBe('Base');
  });

  it('matches the committed wp/theme/theme.json', () => {
    expect(JSON.parse(repoFile('wp/theme/theme.json'))).toEqual(theme);
  });
});

describe('generated names', () => {
  it('match the token keys for every category', () => {
    for (const category of TOKEN_CATEGORIES) {
      expect([...CATEGORY_NAME_LISTS[category]], category).toEqual(Object.keys(tokens[category]));
    }
  });
});

describe('toPhp', () => {
  it('escapes quotes and backslashes', () => {
    expect(toPhp("it's .bb\\:py-4")).toBe("'it\\'s .bb\\\\:py-4'");
  });

  it('exports nested arrays and maps', () => {
    expect(toPhp({ a: [1, '', true], b: null })).toBe(
      "[\n\t'a' => [1, '', true],\n\t'b' => null,\n]",
    );
  });

  it('wraps a value in a PHP file', () => {
    expect(phpReturnFile([1], 'Test.')).toMatch(/^<\?php\n[\s\S]*return \[1\];\n$/);
  });
});
