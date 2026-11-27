import { describe, expect, it, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import type { AppRole } from '../../lib/database.types';
import { AuthRevisionGate, resolveAuthSnapshot } from './auth.lifecycle';

const user = { id: 'user-1', email: 'person@example.com' } as User;
const session = {
  access_token: 'access-token',
  user,
} as Session;

function dependencies(
  overrides: Partial<{
    getUser: ReturnType<typeof vi.fn>;
    loadProfile: ReturnType<typeof vi.fn>;
    clearLocalSession: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    loadProfile: vi.fn().mockResolvedValue({
      data: { role: 'participant' as AppRole },
      error: null,
    }),
    clearLocalSession: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('authentication session lifecycle', () => {
  it('treats a fresh visitor as signed out without querying a profile', async () => {
    const deps = dependencies();

    await expect(resolveAuthSnapshot(null, deps)).resolves.toEqual({
      user: null,
      role: null,
      profileError: false,
    });
    expect(deps.getUser).not.toHaveBeenCalled();
    expect(deps.loadProfile).not.toHaveBeenCalled();
  });

  it('clears a stale session when its deleted Supabase Auth user is rejected', async () => {
    const deps = dependencies({
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'User from sub claim in JWT does not exist', status: 403 },
      }),
    });

    await expect(resolveAuthSnapshot(session, deps)).resolves.toEqual({
      user: null,
      role: null,
      profileError: false,
    });
    expect(deps.clearLocalSession).toHaveBeenCalledTimes(1);
    expect(deps.loadProfile).not.toHaveBeenCalled();
  });

  it('preserves a valid authenticated user and the role from their existing profile', async () => {
    const deps = dependencies({
      loadProfile: vi.fn().mockResolvedValue({
        data: { role: 'administrator' as AppRole },
        error: null,
      }),
    });

    await expect(resolveAuthSnapshot(session, deps)).resolves.toEqual({
      user,
      role: 'administrator',
      profileError: false,
    });
    expect(deps.clearLocalSession).not.toHaveBeenCalled();
  });

  it('does not invent a role or create a profile when the profile row is missing', async () => {
    const deps = dependencies({
      loadProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(resolveAuthSnapshot(session, deps)).resolves.toEqual({
      user,
      role: null,
      profileError: true,
    });
    expect(deps.clearLocalSession).not.toHaveBeenCalled();
  });

  it('keeps public authentication usable when the profile query fails', async () => {
    const deps = dependencies({
      loadProfile: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('network unavailable'),
      }),
    });

    await expect(resolveAuthSnapshot(session, deps)).resolves.toEqual({
      user,
      role: null,
      profileError: true,
    });
  });

  it('does not discard a valid session on a transient Auth API network failure', async () => {
    const deps = dependencies({
      getUser: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    });

    await expect(resolveAuthSnapshot(session, deps)).resolves.toEqual({
      user,
      role: null,
      profileError: true,
    });
    expect(deps.clearLocalSession).not.toHaveBeenCalled();
    expect(deps.loadProfile).not.toHaveBeenCalled();
  });

  it('prevents a profile request from committing after logout/session invalidation', async () => {
    const gate = new AuthRevisionGate();
    const profileRevision = gate.next();
    let finishProfile!: () => void;
    const pendingProfile = new Promise<void>((resolve) => {
      finishProfile = resolve;
    });

    const profileRequest = pendingProfile.then(() => gate.isCurrent(profileRevision));
    gate.next(); // SIGNED_OUT or a newer session event supersedes the pending request.
    finishProfile();

    await expect(profileRequest).resolves.toBe(false);
    expect(gate.isCurrent(profileRevision)).toBe(false);
    gate.dispose();
  });
});
