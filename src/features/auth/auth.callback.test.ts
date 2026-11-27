import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { processAuthCallback } from './auth.callback';

function createAuth() {
  const session = { access_token: 'issued-access-token' };
  const setSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
  const exchangeCodeForSession = vi
    .fn()
    .mockResolvedValue({ data: { session }, error: null });
  return {
    auth: { setSession, exchangeCodeForSession } as unknown as Pick<
      SupabaseClient['auth'],
      'setSession' | 'exchangeCodeForSession'
    >,
    setSession,
    exchangeCodeForSession,
  };
}

describe('Supabase auth callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('establishes a signup session from the implicit-flow hash token URL', async () => {
    const auth = createAuth();
    const callbackUrl =
      'http://localhost:5173/auth/callback#access_token=issued-access-token&refresh_token=issued-refresh-token&type=signup';

    await expect(processAuthCallback(auth.auth, callbackUrl)).resolves.toEqual({
      status: 'success',
    });
    expect(auth.setSession).toHaveBeenCalledTimes(1);
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'issued-access-token',
      refresh_token: 'issued-refresh-token',
    });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('processes the same implicit callback only once when the effect runs twice', async () => {
    const auth = createAuth();
    const callbackUrl =
      'http://localhost:5173/auth/callback#access_token=strict-mode-access&refresh_token=strict-mode-refresh&type=signup';

    const first = processAuthCallback(auth.auth, callbackUrl);
    const second = processAuthCallback(auth.auth, callbackUrl);

    expect(second).toBe(first);
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'success' },
      { status: 'success' },
    ]);
    expect(auth.setSession).toHaveBeenCalledTimes(1);
  });

  it('continues to support PKCE confirmation links', async () => {
    const auth = createAuth();

    await expect(
      processAuthCallback(auth.auth, 'http://localhost:5173/auth/callback?code=pkce-code'),
    ).resolves.toEqual({ status: 'success' });

    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('rejects missing, incomplete, and non-signup implicit callback tokens', async () => {
    const auth = createAuth();
    const urls = [
      'http://localhost:5173/auth/callback',
      'http://localhost:5173/auth/callback#access_token=only-access&type=signup',
      'http://localhost:5173/auth/callback#access_token=a&refresh_token=b&type=recovery',
    ];

    for (const url of urls) {
      await expect(processAuthCallback(auth.auth, url)).resolves.toEqual({
        status: 'invalid_link',
      });
    }
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports a rejected token pair as an invalid or expired link', async () => {
    const auth = createAuth();
    auth.setSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid JWT' },
    } as never);

    await expect(
      processAuthCallback(
        auth.auth,
        'http://localhost:5173/auth/callback#access_token=bad&refresh_token=bad-refresh&type=signup',
      ),
    ).resolves.toEqual({ status: 'invalid_link' });
  });
});
