import { describe, expect, it } from 'vitest';
import { getNextRegistrationStep, type RegistrationProgressState } from './registration.progress';

const empty: RegistrationProgressState = {
  step_1_completed_at: null,
  step_2_completed_at: null,
  step_3_completed_at: null,
  guardian_verified_at: null,
  guardian_verified_email: null,
  guardian_email: null,
  parental_consent_at: null,
};

describe('registration resume step', () => {
  it('starts at personal information when no progress exists', () => {
    expect(getNextRegistrationStep(null)).toBe(1);
    expect(getNextRegistrationStep(empty)).toBe(1);
  });

  it('resumes at education after personal information', () => {
    expect(getNextRegistrationStep({ ...empty, step_1_completed_at: '2026-11-27T10:00:00Z' })).toBe(
      2,
    );
  });

  it('resumes at guardian information after education', () => {
    expect(
      getNextRegistrationStep({
        ...empty,
        step_1_completed_at: '2026-11-27T10:00:00Z',
        step_2_completed_at: '2026-11-27T10:05:00Z',
      }),
    ).toBe(3);
  });

  it('does not advance until the guardian email is verified against the saved address', () => {
    const completedSteps = {
      ...empty,
      step_1_completed_at: '2026-11-27T10:00:00Z',
      step_2_completed_at: '2026-11-27T10:05:00Z',
      step_3_completed_at: '2026-11-27T10:10:00Z',
    };
    expect(getNextRegistrationStep(completedSteps)).toBe(3);
    expect(
      getNextRegistrationStep({
        ...completedSteps,
        guardian_verified_at: '2026-11-27T10:15:00Z',
        guardian_verified_email: 'different@example.test',
        guardian_email: 'parent@example.test',
      }),
    ).toBe(3);
  });

  it('stays on guardian step after email verification until explicit consent is recorded', () => {
    expect(
      getNextRegistrationStep({
        ...empty,
        step_1_completed_at: '2026-11-27T10:00:00Z',
        step_2_completed_at: '2026-11-27T10:05:00Z',
        step_3_completed_at: '2026-11-27T10:10:00Z',
        guardian_verified_at: '2026-11-27T10:15:00Z',
        guardian_verified_email: 'parent@example.test',
        guardian_email: 'parent@example.test',
      }),
    ).toBe(3);
  });

  it('advances to legal agreements after guardian explicitly agrees', () => {
    expect(
      getNextRegistrationStep({
        ...empty,
        step_1_completed_at: '2026-11-27T10:00:00Z',
        step_2_completed_at: '2026-11-27T10:05:00Z',
        step_3_completed_at: '2026-11-27T10:10:00Z',
        guardian_verified_at: '2026-11-27T10:15:00Z',
        guardian_verified_email: 'parent@example.test',
        guardian_email: 'parent@example.test',
        parental_consent_at: '2026-11-27T10:20:00Z',
      }),
    ).toBe(4);
  });
});
