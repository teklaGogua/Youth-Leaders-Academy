import type { SupabaseClient } from '@supabase/supabase-js';

type CallbackAuth = Pick<SupabaseClient['auth'], 'exchangeCodeForSession' | 'setSession'>;

export type AuthCallbackResult =
  | { status: 'success' }
  | { status: 'invalid_link' }
  | { status: 'session_error' };

// React Strict Mode may mount the callback effect twice. Share the same promise
// for an identical callback URL so a one-time code/token pair is consumed once.
const callbackAttempts = new Map<string, Promise<AuthCallbackResult>>();

export function processAuthCallback(
  auth: CallbackAuth,
  callbackUrl: string,
): Promise<AuthCallbackResult> {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const hash = new URLSearchParams(url.hash.slice(1));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const type = hash.get('type');

  if (!code && (!accessToken || !refreshToken || type !== 'signup')) {
    return Promise.resolve({ status: 'invalid_link' });
  }

  const key = code ? 'pkce:' + code : 'implicit:' + accessToken + ':' + refreshToken;
  const existing = callbackAttempts.get(key);
  if (existing) return existing;

  const attempt = (async (): Promise<AuthCallbackResult> => {
    try {
      const { data, error } = code
        ? await auth.exchangeCodeForSession(code)
        : await auth.setSession({
            access_token: accessToken!,
            refresh_token: refreshToken!,
          });

      if (error || !data.session) return { status: 'invalid_link' };
      return { status: 'success' };
    } catch {
      return { status: 'session_error' };
    }
  })();

  callbackAttempts.set(key, attempt);
  if (callbackAttempts.size > 10) {
    const oldestKey = callbackAttempts.keys().next().value;
    if (oldestKey) callbackAttempts.delete(oldestKey);
  }
  return attempt;
}
