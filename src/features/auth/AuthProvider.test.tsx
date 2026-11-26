import { StrictMode, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './AuthProvider';

const mocks = vi.hoisted(() => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
  listener: null as ((event: string, session: unknown) => void) | null,
  profile: { role: 'participant', registration_completed_at: '2026-11-01T00:00:00Z' } as {
    role: 'participant' | 'administrator';
    registration_completed_at: string | null;
  } | null,
}));
vi.mock('../../lib/supabase', () => ({ supabase: mocks.supabase }));
vi.mock('../../lib/env', () => ({ isSupabaseConfigured: true }));

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="email">{auth.user?.email ?? 'signed-out'}</span>
      <span data-testid="role">{auth.role ?? 'no-role'}</span>
      <span data-testid="complete">{String(auth.registrationComplete)}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <button onClick={() => void auth.signOut()}>logout</button>
      <button onClick={() => void auth.refreshProfile()}>refresh</button>
    </div>
  );
}

let root: Root;
let container: HTMLDivElement;
async function mount(node: ReactNode) {
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
}
const session = {
  access_token: 'synthetic-access-token',
  refresh_token: 'synthetic-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1893456000,
  user: { id: 'auth-test-user', aud: 'authenticated', role: 'authenticated', email: 'participant@example.test', email_confirmed_at: '2026-11-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' },
} as Session;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.listener = null;
  mocks.profile = { role: 'participant', registration_completed_at: '2026-11-01T00:00:00Z' };
  mocks.supabase.auth.onAuthStateChange.mockReset().mockImplementation((_event: string, listener: (event: string, session: unknown) => void) => {
    mocks.listener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.supabase.from.mockReset().mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.profile, error: null }) }) }),
  }));
  mocks.supabase.auth.signOut.mockResolvedValue({ error: null });
  mocks.supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('shared persistent authentication provider', () => {
  it('restores an existing session from the initial auth event after a strict-mode remount', async () => {
    await mount(<StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>);
    expect(mocks.supabase.auth.onAuthStateChange).toHaveBeenCalled();
    await act(async () => {
      mocks.listener?.('INITIAL_SESSION', session);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-testid="email"]')?.textContent).toBe('participant@example.test');
    expect(container.querySelector('[data-testid="complete"]')?.textContent).toBe('true');
    expect(container.querySelector('[data-testid="loading"]')?.textContent).toBe('false');
  });

  it('keeps an incomplete participant authenticated without granting completion', async () => {
    mocks.profile = { role: 'participant', registration_completed_at: null };
    await mount(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => {
      mocks.listener?.('INITIAL_SESSION', session);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-testid="email"]')?.textContent).toBe('participant@example.test');
    expect(container.querySelector('[data-testid="complete"]')?.textContent).toBe('false');
  });

  it('does not apply participant completion requirements to administrators', async () => {
    mocks.profile = { role: 'administrator', registration_completed_at: null };
    await mount(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => {
      mocks.listener?.('INITIAL_SESSION', session);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-testid="role"]')?.textContent).toBe('administrator');
    expect(container.querySelector('[data-testid="complete"]')?.textContent).toBe('true');
  });

  it('clears the shared session on explicit logout', async () => {
    await mount(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => {
      mocks.listener?.('INITIAL_SESSION', session);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      container.querySelector('button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-testid="email"]')?.textContent).toBe('signed-out');
  });
});
