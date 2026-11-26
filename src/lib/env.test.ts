import { describe, expect, it } from 'vitest';
import { env, environmentSchema } from './env';

describe('environment schema', () => {
  it('accepts an unconfigured local environment', () => {
    expect(environmentSchema.safeParse({}).success).toBe(true);
    expect(env).toBeDefined();
  });

  it('rejects a partial Supabase configuration', () => {
    expect(
      environmentSchema.safeParse({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
      }).success,
    ).toBe(false);

    expect(
      environmentSchema.safeParse({
        VITE_SUPABASE_ANON_KEY: 'public-anon-key',
      }).success,
    ).toBe(false);
  });

  it('accepts both public Supabase values together', () => {
    expect(
      environmentSchema.safeParse({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'public-anon-key',
      }).success,
    ).toBe(true);
  });
});
