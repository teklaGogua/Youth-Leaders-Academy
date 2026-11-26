import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ParticipantOnboardingPage, ParticipantDashboardPage } from './ParticipantPages';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });

const mocks = vi.hoisted(() => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  user: { id: 'synthetic-user-1', email: 'participant@example.test' },
  signOut: vi.fn(),
  participant: null as unknown,
  calls: [] as unknown[],
}));
vi.mock('../../lib/supabase', () => ({ supabase: mocks.supabase }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user, signOut: mocks.signOut }) }));

const completeParticipant = {
  id: 'synthetic-participant-1', user_id: 'synthetic-user-1',
  first_name: 'ნინო', last_name: 'ტესტი', age: 16, biography: 'სინთეზური ბიოგრაფია',
  school: 'სატესტო სკოლა', grade: '10', teacher_name: 'სატესტო მასწავლებელი',
  parent_contact_name: 'სატესტო მეურვე', parent_contact_phone: '+995555000000',
  parent_contact_email: '', created_at: '2026-11-01T10:00:00.000Z', updated_at: '2026-11-01T10:00:00.000Z',
};
let container: HTMLDivElement;
let root: Root;

async function mount(element: ReactNode) {
  await act(async () => { root.render(element); await new Promise(resolve => setTimeout(resolve, 0)); });
}
async function setFieldValue(id: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
  if (!field) throw new Error(`Field not found: ${id}`);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function submitStep() {
  const button = container.querySelector<HTMLButtonElement>('form button[type="submit"]');
  if (!button) throw new Error('Submit button not found');
  await act(async () => { button.click(); await Promise.resolve(); await Promise.resolve(); });
}
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  mocks.participant = null; mocks.calls.length = 0; mocks.supabase.from.mockReset(); mocks.supabase.rpc.mockReset();
  mocks.supabase.from.mockImplementation((table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.participant, error: null }) }) }),
  }));
  mocks.supabase.rpc.mockImplementation(async (_fn: string, args: unknown) => {
    mocks.calls.push(args); return { data: null, error: null };
  });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('participant account onboarding and dashboard', () => {
  it('saves each onboarding step and completes without selecting a competition', async () => {
    await mount(<MemoryRouter initialEntries={['/onboarding']}><Routes>
      <Route path="/onboarding" element={<ParticipantOnboardingPage />} />
      <Route path="/registration/confirmation" element={<p>პროფილი დასრულებულია</p>} />
    </Routes></MemoryRouter>);

    await setFieldValue('participant-first_name', 'ნინო');
    await setFieldValue('participant-last_name', 'ტესტი');
    await setFieldValue('participant-age', '16');
    await setFieldValue('participant-biography', 'სინთეზური ბიოგრაფია');
    await submitStep();
    await setFieldValue('participant-school', 'სატესტო სკოლა');
    await setFieldValue('participant-grade', '10');
    await setFieldValue('participant-teacher_name', 'სატესტო მასწავლებელი');
    await submitStep();
    await setFieldValue('participant-parent_contact_name', 'სატესტო მეურვე');
    await setFieldValue('participant-parent_contact_phone', '+995555000000');
    await setFieldValue('participant-parent_contact_email', '');
    await submitStep();

    expect(container.textContent).toContain('პროფილი დასრულებულია');
    expect(mocks.supabase.rpc).toHaveBeenCalledTimes(3);
    expect(mocks.calls[0]).toMatchObject({ p_complete: false });
    expect(mocks.calls[1]).toMatchObject({ p_complete: false });
    expect(mocks.calls[2]).toMatchObject({ p_complete: true });
    expect(JSON.stringify(mocks.calls)).not.toContain('competition');
  });

  it('shows only the signed-in participant profile and competition empty state', async () => {
    mocks.participant = completeParticipant;
    await mount(<MemoryRouter><ParticipantDashboardPage /></MemoryRouter>);
    expect(container.textContent).toContain('ნინო ტესტი');
    expect(container.textContent).toContain('სატესტო სკოლა');
    expect(container.textContent).toContain('ჯერ არ გაქვთ კონკურსზე განაცხადები');
    expect(mocks.supabase.from).toHaveBeenCalledWith('participants');
  });
});
