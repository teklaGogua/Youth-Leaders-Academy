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
\nimport { getGeorgianAuthError } from './auth.errors';\n\ndescribe('authentication error messages', () => {\n  it('handles HTTP 429 and provider rate-limit errors in Georgian', () => {\n    expect(getGeorgianAuthError({ status: 429, message: 'too many requests' }, 'register')).toContain('ძალიან ბევრი');\n    expect(getGeorgianAuthError({ code: 'over_email_send_rate_limit' }, 'recovery')).toContain('ძალიან ბევრი');\n    expect(getGeorgianAuthError({ message: 'Email rate limit exceeded' }, 'register')).toContain('ძალიან ბევრი');\n  });\n  it('provides safe and actionable messages', () => {\n    expect(getGeorgianAuthError({ message: 'User already registered' }, 'register')).toContain('უკვე არსებობს');\n    expect(getGeorgianAuthError({ code: 'invalid_credentials' }, 'login')).toContain('არასწორია');\n    expect(getGeorgianAuthError({ message: 'secret technical detail' }, 'register')).not.toContain('secret technical detail');\n  });\n});\n