import type { FluidSize } from './load';

/** Viewport range for fluid type, in px. */
export const FLUID_MIN_VIEWPORT = 320;
export const FLUID_MAX_VIEWPORT = 1280;

const ROOT_FONT_SIZE = 16;

function toRem(value: string): number {
  const number = parseFloat(value);
  return value.endsWith('px') ? number / ROOT_FONT_SIZE : number;
}

function round(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * CSS clamp() that scales linearly from `min` at 320px to `max` at 1280px.
 * Returns the plain value when min === max.
 */
export function fluidClamp({ min, max }: FluidSize): string {
  const minRem = toRem(min);
  const maxRem = toRem(max);
  if (minRem === maxRem) return `${round(minRem)}rem`;

  const minVw = FLUID_MIN_VIEWPORT / ROOT_FONT_SIZE;
  const maxVw = FLUID_MAX_VIEWPORT / ROOT_FONT_SIZE;
  const slope = (maxRem - minRem) / (maxVw - minVw);
  const intercept = minRem - slope * minVw;

  return `clamp(${round(minRem)}rem, ${round(intercept)}rem + ${round(slope * 100)}vw, ${round(maxRem)}rem)`;
}
