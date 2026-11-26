import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { ParentEmailVerificationPage } from './AuthPages';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.invoke.mockReset().mockResolvedValue({ data: { verified: true }, error: null });
  window.history.replaceState({}, '', '/parent-email/verify#token=' + 'a'.repeat(64));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.history.replaceState({}, '', '/');
});

describe('parent email verification callback', () => {
  it('processes a token once under React StrictMode and removes it from the address bar', async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <MemoryRouter initialEntries={['/parent-email/verify']}>
            <ParentEmailVerificationPage />
          </MemoryRouter>
        </StrictMode>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('parent-email-verification', {
      body: { action: 'verify', token: 'a'.repeat(64) },
    });
    expect(window.location.hash).toBe('');
    expect(container.textContent).toContain('მშობლის / მეურვის ელფოსტა წარმატებით დადასტურდა');
  });

  it('shows an actionable error when the server rejects a replayed token', async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { verified: false },
      error: null,
    });
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/parent-email/verify']}>
          <ParentEmailVerificationPage />
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('უკვე გამოყენებულია');
  });
});
