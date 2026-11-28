import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from './PublicLayout';

const authState = vi.hoisted(() => ({
  user: null as { email: string } | null,
}));

vi.mock('../../features/auth/AuthProvider', () => ({
  useAuth: () => authState,
}));

const mounted: { root: Root; container: HTMLDivElement }[] = [];

async function renderNavigation(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<p>მთავარი გვერდი</p>} />
            <Route path="profile" element={<h1>პროფილის გვერდი</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });

  return container;
}

describe('signed-in public navigation', () => {
  beforeEach(() => {
    authState.user = null;
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it('keeps separate login and registration links for signed-out users', async () => {
    for (const width of [390, 1440]) {
      const container = await renderNavigation(width);
      expect(container.querySelector('a[href="/login"]')?.textContent).toContain('შესვლა');
      expect(container.querySelector('a[href="/registration"]')?.textContent).toContain(
        'რეგისტრაცია',
      );
      expect(container.querySelector('a[href="/profile"]')).toBeNull();
    }
  });

  it('shows one profile link and opens the profile on desktop and mobile', async () => {
    authState.user = { email: 'participant@example.com' };

    for (const width of [390, 1440]) {
      const container = await renderNavigation(width);
      const profileLink = container.querySelector<HTMLAnchorElement>('a[href="/profile"]');

      expect(profileLink?.textContent).toContain('პროფილი');
      expect(container.querySelector('a[href="/login"]')).toBeNull();
      expect(container.querySelector('a[href="/registration"]')).toBeNull();

      if (width <= 1100) {
        const menuButton = container.querySelector<HTMLButtonElement>(
          'button[aria-controls="public-navigation"]',
        );
        await act(async () => menuButton?.click());
        expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
      }

      await act(async () => {
        profileLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(container.textContent).toContain('პროფილის გვერდი');
    }
  });
});
