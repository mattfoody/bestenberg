import { z } from 'zod/v4';

/** Token categories, in output order. */
export const TOKEN_CATEGORIES = [
  'color',
  'space',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'lineHeight',
  'radius',
  'shadow',
  'container',
  'breakpoint',
] as const;

export type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

export interface FluidSize {
  min: string;
  max: string;
}

/** Normalized tokens: category → name → value. Names keep source order. */
export interface Tokens {
  color: Record<string, string>;
  space: Record<string, string>;
  fontSize: Record<string, FluidSize>;
  fontFamily: Record<string, string[]>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  container: Record<string, string>;
  breakpoint: Record<string, string>;
}

export class TokenError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid design tokens:\n- ${issues.join('\n- ')}`);
    this.name = 'TokenError';
  }
}

const NAME = /^[a-z0-9][a-z0-9-]*$/;
const dimension = z.string().regex(/^(0|\d*\.?\d+(px|rem|em|%))$/, 'expected a length like 1rem');
const length = z.string().regex(/^\d*\.?\d+(px|rem)$/, 'expected px or rem');

const VALUE_SCHEMAS: Record<TokenCategory, { type: string; value: z.ZodType }> = {
  color: { type: 'color', value: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i) },
  space: { type: 'dimension', value: dimension },
  fontSize: { type: 'fluidDimension', value: z.strictObject({ min: length, max: length }) },
  fontFamily: { type: 'fontFamily', value: z.array(z.string().min(1)).min(1) },
  fontWeight: { type: 'fontWeight', value: z.number().int().min(100).max(1000) },
  lineHeight: { type: 'number', value: z.number().positive().max(4) },
  radius: { type: 'dimension', value: dimension },
  shadow: { type: 'shadow', value: z.string().min(1) },
  container: { type: 'dimension', value: length },
  breakpoint: { type: 'dimension', value: z.string().regex(/^\d+px$/, 'expected px') },
};

/** Utility prefixes that several categories share; names must not collide inside one. */
const SHARED_PREFIXES: Array<{ prefix: string; sources: Array<TokenCategory | string[]> }> = [
  { prefix: 'text-', sources: ['color', 'fontSize', ['start', 'center', 'end']] },
  { prefix: 'font-', sources: ['fontFamily', 'fontWeight'] },
  { prefix: 'border-', sources: ['color', ['0', '1', '2']] },
  { prefix: 'bg-', sources: ['color', ['cover']] },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a DTCG token document and returns normalized tokens.
 * Throws TokenError listing every problem found.
 */
export function loadTokens(raw: unknown): Tokens {
  const issues: string[] = [];
  const out = {} as Record<TokenCategory, Record<string, unknown>>;

  if (!isRecord(raw)) {
    throw new TokenError(['token file must be an object']);
  }

  for (const category of TOKEN_CATEGORIES) {
    const group = raw[category];
    const { type, value } = VALUE_SCHEMAS[category];
    out[category] = {};

    if (!isRecord(group)) {
      issues.push(`${category}: missing group`);
      continue;
    }
    if (group.$type !== type) {
      issues.push(`${category}: $type must be "${type}"`);
    }

    for (const [name, token] of Object.entries(group)) {
      if (name.startsWith('$')) continue;
      if (!NAME.test(name)) {
        issues.push(`${category}.${name}: name must match ${NAME}`);
        continue;
      }
      if (!isRecord(token) || !('$value' in token)) {
        issues.push(`${category}.${name}: missing $value`);
        continue;
      }
      const parsed = value.safeParse(token.$value);
      if (!parsed.success) {
        issues.push(`${category}.${name}: ${parsed.error.issues[0]?.message ?? 'invalid value'}`);
        continue;
      }
      out[category][name] = parsed.data;
    }

    if (Object.keys(out[category]).length === 0) {
      issues.push(`${category}: needs at least one token`);
    }
  }

  const breakpoints = Object.keys(out.breakpoint);
  if (breakpoints.join(',') !== 'md,lg') {
    issues.push('breakpoint: must define exactly "md" then "lg"');
  } else if (parseFloat(String(out.breakpoint.md)) >= parseFloat(String(out.breakpoint.lg))) {
    issues.push('breakpoint: md must be smaller than lg');
  }

  for (const { prefix, sources } of SHARED_PREFIXES) {
    const seen = new Map<string, string>();
    for (const source of sources) {
      const label = Array.isArray(source) ? 'built-in' : source;
      const names = Array.isArray(source) ? source : Object.keys(out[source]);
      for (const name of names) {
        const other = seen.get(name);
        if (other !== undefined && other !== label) {
          issues.push(`"${prefix}${name}" would be ambiguous (${other} and ${label})`);
        }
        seen.set(name, label);
      }
    }
  }

  if (issues.length > 0) {
    throw new TokenError(issues);
  }
  return out as unknown as Tokens;
}
