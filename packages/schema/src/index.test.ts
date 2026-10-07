import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from './index';

describe('@bestenberg/schema', () => {
  it('exposes the current schema version', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
