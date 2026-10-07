import { describe, expect, it } from 'vitest';
import { blockName } from './index';

describe('@bestenberg/adapter-blocks', () => {
  it('builds namespaced block names', () => {
    expect(blockName('section')).toBe('bestenberg/section');
  });
});
