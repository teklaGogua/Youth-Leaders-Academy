import { describe, expect, it } from 'vitest';
import {
  getAuthenticatedHomeRoute,
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

  it('returns the homepage after successful authentication', () => {
    expect(getAuthenticatedHomeRoute()).toBe('/');
  });
});

import { getGeorgianAuthError } from './auth.errors';

describe('authentication error messages', () => {
  it('handles HTTP 429 and provider rate-limit errors in Georgian', () => {
    expect(
      getGeorgianAuthError({ status: 429, message: 'too many requests' }, 'register'),
    ).toContain('ძალიან ბევრი');
    expect(getGeorgianAuthError({ code: 'over_email_send_rate_limit' }, 'recovery')).toContain(
      'ძალიან ბევრი',
    );
    expect(getGeorgianAuthError({ message: 'Email rate limit exceeded' }, 'register')).toContain(
      'ძალიან ბევრი',
    );
  });

  it('provides safe and actionable messages', () => {
    expect(getGeorgianAuthError({ message: 'User already registered' }, 'register')).toContain(
      'უკვე არსებობს',
    );
    expect(getGeorgianAuthError({ code: 'invalid_credentials' }, 'login')).toContain('არასწორია');
    expect(getGeorgianAuthError({ message: 'secret technical detail' }, 'register')).not.toContain(
      'secret technical detail',
    );
  });
});
