import type { Session, User } from '@supabase/supabase-js';
import type { AppRole } from '../../lib/database.types';

export type AuthSnapshot = {
  user: User | null;
  role: AppRole | null;
  profileError: boolean;
};

type AuthError = { code?: string; status?: number; message?: string } | null;

export type AuthLifecycleDependencies = {
  getUser: (accessToken: string) => Promise<{
    data: { user: User | null };
    error: AuthError;
  }>;
  loadProfile: (userId: string) => Promise<{
    data: { role: AppRole } | null;
    error: unknown;
  }>;
  clearLocalSession: () => Promise<unknown>;
};

export function isInvalidAuthSessionError(error: AuthError): boolean {
  if (!error) return false;
  if (error.status === 401) return true;

  const code = error.code?.toLowerCase();
  if (
    code &&
    [
      'bad_jwt',
      'session_not_found',
      'refresh_token_not_found',
      'invalid_grant',
      'user_not_found',
      'session_expired',
    ].includes(code)
  ) {
    return true;
  }

  return /invalid (jwt|token|session)|user.*(not found|does not exist|deleted)|refresh token.*(not found|invalid|already used)|invalid refresh token|jwt.*expired|session (not found|expired)/i.test(
    error.message ?? '',
  );
}

const signedOutSnapshot: AuthSnapshot = {
  user: null,
  role: null,
  profileError: false,
};

/**
 * Validate persisted sessions against Supabase Auth before trusting their user
 * identity. A missing profile is deliberately not repaired with a guessed role:
 * only the auth.users insert trigger provisions new participant profiles.
 */
export async function resolveAuthSnapshot(
  session: Session | null,
  dependencies: AuthLifecycleDependencies,
): Promise<AuthSnapshot> {
  if (!session) return signedOutSnapshot;

  let verifiedUser: User | null;
  try {
    const result = await dependencies.getUser(session.access_token);
    if (result.error) {
      if (isInvalidAuthSessionError(result.error)) {
        await dependencies.clearLocalSession().catch(() => undefined);
        return signedOutSnapshot;
      }
      return { user: session.user, role: null, profileError: true };
    }
    verifiedUser = result.data.user;
  } catch (error) {
    if (
      isInvalidAuthSessionError(
        error && typeof error === 'object'
          ? (error as AuthError)
          : { message: String(error) },
      )
    ) {
      await dependencies.clearLocalSession().catch(() => undefined);
      return signedOutSnapshot;
    }
    return { user: session.user, role: null, profileError: true };
  }

  if (!verifiedUser || verifiedUser.id !== session.user.id) {
    await dependencies.clearLocalSession().catch(() => undefined);
    return signedOutSnapshot;
  }

  try {
    const { data, error } = await dependencies.loadProfile(verifiedUser.id);
    if (error || !data) return { user: verifiedUser, role: null, profileError: true };
    return { user: verifiedUser, role: data.role, profileError: false };
  } catch {
    return { user: verifiedUser, role: null, profileError: true };
  }
}

/**
 * Monotonic request revisions prevent late session/profile reads from overwriting
 * newer authentication events.
 */
export class AuthRevisionGate {
  private revision = 0;
  private active = true;

  next(): number {
    this.revision += 1;
    return this.revision;
  }

  isCurrent(revision: number): boolean {
    return this.active && revision === this.revision;
  }

  dispose(): void {
    this.active = false;
    this.revision += 1;
  }
}
