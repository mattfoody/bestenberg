import { describe, expect, it } from 'vitest';
import { MAX_REPAIR_ROUNDS } from './index';

describe('@bestenberg/ai', () => {
  it('limits repair rounds to 3', () => {
    expect(MAX_REPAIR_ROUNDS).toBe(3);
  });
});
