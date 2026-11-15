import { tokens, type TokenCategory } from '@bestenberg/tokens';

/**
 * Token snapping (PLAN.md §6.4): models often answer with near-misses —
 * `"primary"`, `"space.7"`, `"#1e40af"`, `"24px"`. Each is mapped to the
 * nearest design token so the document validates without a repair round.
 */

type SnapCategory = Exclude<TokenCategory, 'breakpoint'>;

const REM_PX = 16;

/** A CSS length in px, or null. Bare numbers count as px. */
function toPx(value: string): number | null {
  const match = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === 'rem' || match[2] === 'em' ? amount * REM_PX : amount;
}

function hexToRgb(value: string): [number, number, number] | null {
  let hex = value.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function nearest<T>(items: readonly T[], distance: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const item of items) {
    const d = distance(item);
    if (d < bestDistance) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}

/** Numeric size of a token, for nearest-value matching. */
function tokenSize(category: SnapCategory, name: string): number | null {
  switch (category) {
    case 'space':
    case 'radius':
    case 'container':
      return toPx(tokens[category][name]!);
    case 'fontSize':
      return toPx(tokens.fontSize[name]!.max);
    case 'fontWeight':
      return tokens.fontWeight[name]!;
    case 'lineHeight':
      return tokens.lineHeight[name]!;
    default:
      return null;
  }
}

const COLOR_ALIASES: Record<string, string> = {
  white: 'surface',
  background: 'surface',
  black: 'on-surface',
  text: 'on-surface',
  foreground: 'on-surface',
  gray: 'muted',
  grey: 'muted',
  secondary: 'accent',
  error: 'danger',
  red: 'danger',
  green: 'success',
};

const WORD_ALIASES: Partial<Record<SnapCategory, Record<string, string>>> = {
  color: COLOR_ALIASES,
  fontWeight: {
    normal: 'regular',
    '400': 'regular',
    '500': 'medium',
    '600': 'semibold',
    '700': 'bold',
  },
  fontFamily: { 'sans-serif': 'sans', monospace: 'mono' },
  radius: { rounded: 'md', pill: 'full', round: 'full' },
  shadow: { small: 'sm', medium: 'md', large: 'lg' },
  container: { small: 'sm', medium: 'md', large: 'lg', wide: 'xl' },
};

/**
 * The token reference (`"space.4"`) nearest to `value` in `category`, or
 * undefined when nothing sensible matches (the caller then drops the value).
 */
export function snapToken(category: SnapCategory, value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const names = Object.keys(tokens[category]);
  const ref = (name: string) => `${category}.${name}`;
  let raw = String(value).trim();
  if (raw === '') return undefined;

  // Strip any "category." prefix, including a wrong or differently-cased one.
  const dot = raw.indexOf('.');
  if (dot > 0 && /^[a-zA-Z]+$/.test(raw.slice(0, dot))) raw = raw.slice(dot + 1);
  const lower = raw.toLowerCase();

  if (names.includes(raw)) return ref(raw);
  if (names.includes(lower)) return ref(lower);
  const alias = WORD_ALIASES[category]?.[lower];
  if (alias && names.includes(alias)) return ref(alias);

  if (category === 'color') {
    const rgb = hexToRgb(lower);
    if (!rgb) return undefined;
    const best = nearest(names, (name) => {
      const other = hexToRgb(tokens.color[name]!);
      return other
        ? other.reduce((sum, channel, i) => sum + (channel - rgb[i]!) ** 2, 0)
        : Infinity;
    });
    return best === undefined ? undefined : ref(best);
  }

  if (category === 'fontFamily' || category === 'shadow') return undefined;

  // Numeric: a token-scale number ("7" between space 6 and 8) or a CSS length.
  let target: number | null;
  if (category === 'space' && /^\d+(\.\d+)?$/.test(lower)) {
    target = Number(lower) * 4; // The space scale is n × 0.25rem.
  } else if (category === 'fontWeight' || category === 'lineHeight') {
    target = /^\d*\.?\d+$/.test(lower) ? Number(lower) : null;
  } else {
    target = toPx(lower);
  }
  if (target === null || target < 0) return undefined;
  const best = nearest(names, (name) => {
    const size = tokenSize(category, name);
    return size === null ? Infinity : Math.abs(size - target);
  });
  return best === undefined ? undefined : ref(best);
}
