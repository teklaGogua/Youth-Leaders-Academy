import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CompetitionRegistrationPage, ParticipantDashboardPage } from './ParticipantPages';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

type QueryCall = { table: string; method: string; args: unknown[] };

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  user: { id: 'synthetic-user-1', email: 'participant@example.test' },
  signOut: vi.fn(),
  results: {} as Record<string, { data: unknown; error: unknown }>,
  calls: [] as QueryCall[],
}));

vi.mock('../../lib/supabase', () => ({ supabase: mocks.supabase }));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mocks.user,
    signOut: mocks.signOut,
  }),
}));

const competition = {
  id: 'synthetic-competition-1',
  slug: 'phase6-synthetic-demo',
  title: 'სინთეზური სატესტო კონკურსი',
  description: 'სატესტო აღწერა',
  registration_start: null,
  registration_end: null,
  event_date: null,
  fee: 0,
  status: 'published' as const,
  created_at: '2026-11-01T10:00:00.000Z',
  updated_at: '2026-11-01T10:00:00.000Z',
};

const participant = {
  id: 'synthetic-participant-1',
  user_id: 'synthetic-user-1',
  first_name: 'ნინო',
  last_name: 'ტესტი',
  age: 16,
  biography: 'სინთეზური სატესტო ბიოგრაფია',
  school: 'სატესტო სკოლა',
  grade: '10',
  teacher_name: 'სატესტო მასწავლებელი',
  parent_contact_name: 'სატესტო მშობელი',
  parent_contact_phone: '+995555000000',
  parent_contact_email: '',
  created_at: '2026-11-01T10:00:00.000Z',
  updated_at: '2026-11-01T10:00:00.000Z',
};

const application = {
  id: 'synthetic-application-1',
  participant_id: participant.id,
  competition_id: competition.id,
  status: 'registered' as const,
  created_at: '2026-11-01T10:00:00.000Z',
  updated_at: '2026-11-01T10:00:00.000Z',
};

type Query = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
};

let container: HTMLDivElement;
let root: Root;

function configureQueries() {
  mocks.supabase.from.mockImplementation((table: string) => {
    const query: Query = {
      select: vi.fn(() => query),
      eq: vi.fn((...args: unknown[]) => {
        mocks.calls.push({ table, method: 'eq', args });
        return query;
      }),
      order: vi.fn(async (...args: unknown[]) => {
        mocks.calls.push({ table, method: 'order', args });
        return mocks.results[table];
      }),
      maybeSingle: vi.fn(async () => mocks.results[table]),
      in: vi.fn(async (...args: unknown[]) => {
        mocks.calls.push({ table, method: 'in', args });
        return mocks.results[table];
      }),
    };

    return query;
  });
}

async function mount(element: ReactNode) {
  await act(async () => {
    root.render(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function setFieldValue(id: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `#${id}`,
  );

  if (!field) throw new Error(`Field not found: ${id}`);

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function submitCurrentStep() {
  const button = container.querySelector<HTMLButtonElement>('form button[type="submit"]');
  if (!button) throw new Error('Submit button not found');

  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.calls.length = 0;
  mocks.results = {};
  mocks.supabase.from.mockReset();
  mocks.supabase.rpc.mockReset();
  configureQueries();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('participant registration and dashboard', () => {
  it('completes the four-step registration and submits the participant-owned payload', async () => {
    mocks.results.competitions = { data: [competition], error: null };
    mocks.results.participants = { data: null, error: null };
    mocks.supabase.rpc.mockResolvedValue({
      data: [
        {
          application_id: application.id,
          participant_id: participant.id,
          application_status: 'registered',
        },
      ],
      error: null,
    });

    await mount(
      <MemoryRouter initialEntries={['/apply']}>
        <Routes>
          <Route path="/apply" element={<CompetitionRegistrationPage />} />
          <Route path="/application/confirmation" element={<p>განაცხადი დადასტურებულია</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await setFieldValue('participant-first_name', 'ნინო');
    await setFieldValue('participant-last_name', 'ტესტი');
    await setFieldValue('participant-age', '16');
    await setFieldValue('participant-biography', 'სინთეზური სატესტო ბიოგრაფია');
    await submitCurrentStep();

    await setFieldValue('participant-school', 'სატესტო სკოლა');
    await setFieldValue('participant-grade', '10');
    await setFieldValue('participant-teacher_name', 'სატესტო მასწავლებელი');
    await submitCurrentStep();

    await setFieldValue('participant-parent_contact_name', 'სატესტო მშობელი');
    await setFieldValue('participant-parent_contact_phone', '+995555000000');
    await setFieldValue('participant-parent_contact_email', '');
    await submitCurrentStep();

    await setFieldValue('participant-competition', competition.id);
    await submitCurrentStep();

    expect(container.textContent).toContain('განაცხადი დადასტურებულია');
    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      'submit_competition_application',
      expect.objectContaining({
        p_competition_id: competition.id,
        p_participant: expect.objectContaining({
          first_name: 'ნინო',
          last_name: 'ტესტი',
          age: 16,
          school: 'სატესტო სკოლა',
          parent_contact_name: 'სატესტო მშობელი',
        }),
      }),
    );
  });

  it('loads only the signed-in participant applications in the dashboard', async () => {
    mocks.results.participants = { data: participant, error: null };
    mocks.results.applications = { data: [application], error: null };
    mocks.results.competitions = { data: [competition], error: null };

    await mount(
      <MemoryRouter>
        <ParticipantDashboardPage />
      </MemoryRouter>,
    );

    expect(container.textContent).toContain('სინთეზური სატესტო კონკურსი');
    expect(container.textContent).toContain('ნინო ტესტი');
    expect(container.textContent).toContain('მიღებულია');
    expect(mocks.calls).toContainEqual({
      table: 'applications',
      method: 'eq',
      args: ['participant_id', participant.id],
    });
  });
});
