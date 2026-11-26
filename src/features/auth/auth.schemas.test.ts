import { describe, expect, it } from 'vitest';
import {
  getHomeRouteForRole,
  isSafeRedirectPath,
  loginSchema,
  passwordResetSchema,
  registrationSchema,
} from './auth.schemas';

describe('authentication validation', () => {
  it('accepts a valid login and rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'person@example.com', password: 'pass' }).success).toBe(
      true,
    );
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'pass' }).success).toBe(false);
  });

  it('requires a password of at least eight characters for new accounts', () => {
    const result = registrationSchema.safeParse({
      firstName: 'ანა',
      lastName: 'ბერიძე',
      email: 'ana@example.com',
      password: 'short',
      passwordConfirmation: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('requires matching password confirmation', () => {
    const result = passwordResetSchema.safeParse({
      password: 'secure-pass-123',
      passwordConfirmation: 'different-pass',
    });
    expect(result.success).toBe(false);
  });

  it('does not accept protocol-relative redirect destinations', () => {
    expect(isSafeRedirectPath('/dashboard')).toBe(true);
    expect(isSafeRedirectPath('//evil.example')).toBe(false);
    expect(isSafeRedirectPath('https://evil.example')).toBe(false);
  });

  it('routes each role to its own landing page', () => {
    expect(getHomeRouteForRole('participant')).toBe('/dashboard');
    expect(getHomeRouteForRole('administrator')).toBe('/admin');
  });
});
