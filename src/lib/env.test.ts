import { describe, expect, it } from 'vitest';
import { env } from './env';

describe('environment schema', () => {
  it('accepts optional development environment values', () => {
    expect(env).toBeDefined();
  });
});
