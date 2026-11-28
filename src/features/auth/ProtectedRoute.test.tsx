import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const authState = vi.hoisted(() => ({
  user: { id: 'participant-id' } as { id: string } | null,
  role: 'participant' as 'participant' | 'administrator' | null,
  loading: false,
  profileError: false,
  configured: true,
}));

const registrationQuery = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
}));

vi.mock('./AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        maybeSingle: registrationQuery.maybeSingle,
      }),
    }),
  },
}));

const mounted: { root: Root; container: HTMLDivElement }[] = [];

async function renderRoute(path: '/profile' | '/dashboard') {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowIncompleteRegistration>
                <h1>პირადი პროფილი</h1>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <h1>დასრულებული კაბინეტი</h1>
              </ProtectedRoute>
            }
          />
          <Route path="/registration" element={<h1>რეგისტრაციის გაგრძელება</h1>} />
          <Route path="/login" element={<h1>შესვლა</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });

  return container;
}

describe('profile route access', () => {
  beforeEach(() => {
    authState.user = { id: 'participant-id' };
    authState.role = 'participant';
    authState.loading = false;
    authState.profileError = false;
    authState.configured = true;
    registrationQuery.maybeSingle.mockResolvedValue({
      data: { completed_at: null },
      error: null,
    });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it('allows a signed-in participant to view their incomplete profile', async () => {
    const container = await renderRoute('/profile');
    expect(container.textContent).toContain('პირადი პროფილი');
  });

  it('continues to require completed registration for the dashboard', async () => {
    const container = await renderRoute('/dashboard');
    expect(container.textContent).toContain('რეგისტრაციის გაგრძელება');
    expect(container.textContent).not.toContain('დასრულებული კაბინეტი');
  });

  it('does not expose the profile route to signed-out visitors', async () => {
    authState.user = null;
    const container = await renderRoute('/profile');
    expect(container.textContent).toContain('შესვლა');
    expect(container.textContent).not.toContain('პირადი პროფილი');
  });
});
