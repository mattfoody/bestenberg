import { describe, expect, it } from 'vitest';
import { CSS_VAR_PREFIX, UTILITY_PREFIX } from './index';

describe('@bestenberg/tokens', () => {
  it('uses the bb prefix for variables and utilities', () => {
    expect(CSS_VAR_PREFIX).toBe('bb');
    expect(UTILITY_PREFIX).toBe('bb');
  });
});
