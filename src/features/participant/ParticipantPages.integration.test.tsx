import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ParticipantOnboardingPage, ParticipantDashboardPage } from './ParticipantPages';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
  user: { id: 'synthetic-user-1', email: 'participant@example.test' },
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
  participant: null as unknown,
  calls: [] as Array<{ fn: string; args: unknown }>,
}));
vi.mock('../../lib/supabase', () => ({ supabase: mocks.supabase }));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mocks.user,
    signOut: mocks.signOut,
    refreshProfile: mocks.refreshProfile,
  }),
}));

const completeParticipant = {
  id: 'synthetic-participant-1',
  user_id: 'synthetic-user-1',
  first_name: 'ნინო',
  last_name: 'ტესტი',
  age: 16,
  biography: 'სინთეზური ბიოგრაფია',
  school: 'სატესტო სკოლა',
  grade: '10',
  teacher_name: 'სატესტო მასწავლებელი',
  parent_contact_name: 'სატესტო მეურვე',
  parent_contact_phone: '+995555000000',
  parent_contact_email: 'guardian@example.test',
  parent_contact_email_verified_at: '2026-11-01T10:00:00.000Z',
  created_at: '2026-11-01T10:00:00.000Z',
  updated_at: '2026-11-01T10:00:00.000Z',
};
const publishedDocuments = [
  { slug: 'terms', version: 'terms-v1', is_published: true },
  { slug: 'privacy', version: 'privacy-v1', is_published: true },
];

let container: HTMLDivElement;
let root: Root;

async function mount(element: ReactNode) {
  await act(async () => {
    root.render(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.participant = null;
  mocks.calls.length = 0;
  mocks.refreshProfile.mockReset().mockResolvedValue(undefined);
  mocks.signOut.mockReset().mockResolvedValue(undefined);
  mocks.supabase.from.mockReset().mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: mocks.participant, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: table === 'registration_documents' ? publishedDocuments : [],
            error: null,
          }).then(resolve),
      }),
    }),
  }));
  mocks.supabase.rpc.mockReset().mockImplementation(async (fn: string, args: unknown) => {
    mocks.calls.push({ fn, args });
    if (fn === 'get_participant_registration_profile')
      return { data: mocks.participant ? [mocks.participant] : [], error: null };
    return { data: null, error: null };
  });
  mocks.supabase.auth.getSession.mockReset().mockResolvedValue({
    data: { session: { access_token: 'synthetic-access-token' } },
    error: null,
  });
  mocks.supabase.functions.invoke.mockReset().mockResolvedValue({
    data: { sent: true, verified: true },
    error: null,
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('participant account registration and dashboard', () => {
  it('saves all three profile steps without creating a competition application', async () => {
    await mount(
      <MemoryRouter initialEntries={['/register?step=2']}>
        <Routes>
          <Route path="/register" element={<ParticipantOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

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
    await setFieldValue('participant-parent_contact_email', 'guardian@example.test');
    await submitStep();

    const saves = mocks.calls.filter((call) => call.fn === 'save_participant_profile');
    expect(saves).toHaveLength(3);
    expect(saves.every((call) => (call.args as { p_complete: boolean }).p_complete === false)).toBe(
      true,
    );
    expect(mocks.supabase.functions.invoke).toHaveBeenCalledWith(
      'parent-email-verification',
      expect.objectContaining({ body: { action: 'send', email: 'guardian@example.test' } }),
    );
    expect(mocks.calls.some((call) => call.fn === 'complete_participant_registration')).toBe(false);
    expect(JSON.stringify(mocks.calls)).not.toContain('competition');
  });

  it('requires the unchecked Terms and Privacy acceptance before completion', async () => {
    mocks.participant = completeParticipant;
    await mount(
      <MemoryRouter initialEntries={['/register?step=4']}>
        <Routes>
          <Route path="/register" element={<ParticipantOnboardingPage />} />
          <Route path="/dashboard" element={<p>პირადი კაბინეტი</p>} />
        </Routes>
      </MemoryRouter>,
    );

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const complete = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('რეგისტრაციის დასრულება'),
    );
    expect(checkbox?.checked).toBe(false);
    expect(complete?.disabled).toBe(true);

    await act(async () => {
      checkbox?.click();
    });
    expect(complete?.disabled).toBe(false);
    await act(async () => {
      complete?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.calls.some((call) => call.fn === 'complete_participant_registration')).toBe(true);
    expect(container.textContent).toContain('პირადი კაბინეტი');
  });

  it('shows only the signed-in participant profile and competition empty state', async () => {
    mocks.participant = completeParticipant;
    await mount(
      <MemoryRouter>
        <ParticipantDashboardPage />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('ნინო ტესტი');
    expect(container.textContent).toContain('სატესტო სკოლა');
    expect(container.textContent).toContain('ჯერ არ გაქვთ კონკურსზე განაცხადები');
    expect(mocks.supabase.from).toHaveBeenCalledWith('participants');
  });
});
