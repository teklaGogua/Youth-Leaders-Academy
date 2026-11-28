import { describe, expect, it, vi } from 'vitest';
import {
  isGuardianAction,
  isGuardianDecision,
  isGuardianToken,
  isValidGuardianEmail,
} from '../../../supabase/functions/guardian-verification/logic';
import {
  getGuardianDocumentVersions,
  saveGuardianBeforeVerification,
  type SavedGuardianRegistration,
} from './guardian-verification';

const guardian = {
  guardianFullName: 'Nino Gogua',
  guardianPhone: '+995 555 123456',
  guardianEmail: 'PARENT@example.test',
};

const savedRegistration: SavedGuardianRegistration = {
  user_id: 'participant-user-123',
  guardian_full_name: 'Nino Gogua',
  guardian_phone: '+995 555 123456',
  guardian_email: 'parent@example.test',
  step_3_completed_at: '2026-11-28T10:00:00.000Z',
};

function dependencies(
  overrides: {
    saveError?: string | null;
    loadError?: string | null;
    registration?: SavedGuardianRegistration | null;
    requestError?: string | null;
  } = {},
) {
  const sequence: string[] = [];
  const saveGuardian = vi.fn(async () => {
    sequence.push('save');
    return { error: overrides.saveError ?? null };
  });
  const loadRegistration = vi.fn(async () => {
    sequence.push('read');
    return {
      data: overrides.registration === undefined ? savedRegistration : overrides.registration,
      error: overrides.loadError ?? null,
    };
  });
  const requestVerification = vi.fn(async () => {
    sequence.push('request');
    return { error: overrides.requestError ?? null };
  });
  return {
    sequence,
    saveGuardian,
    loadRegistration,
    requestVerification,
    participantId: 'participant-user-123',
  };
}

describe('save guardian before requesting verification', () => {
  it('saves and verifies only after reading the persisted guardian', async () => {
    const deps = dependencies();
    const result = await saveGuardianBeforeVerification(guardian, deps);

    expect(result.status).toBe('sent');
    expect(deps.sequence).toEqual(['save', 'read', 'request']);
    expect(deps.saveGuardian).toHaveBeenCalledWith({
      guardianFullName: 'Nino Gogua',
      guardianPhone: '+995 555 123456',
      guardianEmail: 'parent@example.test',
    });
    expect(deps.requestVerification).toHaveBeenCalledWith({
      participantId: 'participant-user-123',
      registrationId: 'participant-user-123',
    });
  });

  it('does not save or request verification when guardian details are invalid', async () => {
    const deps = dependencies();
    const result = await saveGuardianBeforeVerification(
      { ...guardian, guardianEmail: 'not-an-email' },
      deps,
    );

    expect(result.status).toBe('invalid');
    expect(deps.saveGuardian).not.toHaveBeenCalled();
    expect(deps.loadRegistration).not.toHaveBeenCalled();
    expect(deps.requestVerification).not.toHaveBeenCalled();
  });

  it('does not read or request verification when the database save fails', async () => {
    const deps = dependencies({ saveError: 'database rejected guardian details' });
    const result = await saveGuardianBeforeVerification(guardian, deps);

    expect(result.status).toBe('save_failed');
    expect(deps.saveGuardian).toHaveBeenCalledTimes(1);
    expect(deps.loadRegistration).not.toHaveBeenCalled();
    expect(deps.requestVerification).not.toHaveBeenCalled();
  });

  it('does not request verification when the saved registration cannot be read', async () => {
    const deps = dependencies({ loadError: 'read failed' });
    const result = await saveGuardianBeforeVerification(guardian, deps);

    expect(result.status).toBe('read_failed');
    expect(deps.sequence).toEqual(['save', 'read']);
    expect(deps.requestVerification).not.toHaveBeenCalled();
  });

  it('does not request verification when the saved guardian differs', async () => {
    const deps = dependencies({
      registration: { ...savedRegistration, guardian_phone: '+995 555 000000' },
    });
    const result = await saveGuardianBeforeVerification(guardian, deps);

    expect(result.status).toBe('saved_record_mismatch');
    expect(deps.requestVerification).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...guardian, guardianFullName: '  ' }, 'missing guardian name'],
    [{ ...guardian, guardianPhone: '123' }, 'invalid guardian phone'],
  ])('rejects %s before any database or Edge Function call', async (invalidGuardian) => {
    const deps = dependencies();
    const result = await saveGuardianBeforeVerification(invalidGuardian, deps);

    expect(result.status).toBe('invalid');
    expect(deps.saveGuardian).not.toHaveBeenCalled();
    expect(deps.requestVerification).not.toHaveBeenCalled();
  });

  it('rejects a saved registration owned by a different participant', async () => {
    const deps = dependencies({
      registration: { ...savedRegistration, user_id: 'another-participant' },
    });
    const result = await saveGuardianBeforeVerification(guardian, deps);

    expect(result.status).toBe('saved_record_mismatch');
    expect(deps.requestVerification).not.toHaveBeenCalled();
  });

  it('does not request verification after a rejected save', async () => {
    const deps = dependencies();
    deps.saveGuardian.mockRejectedValueOnce(new Error('network unavailable'));
    const result = await saveGuardianBeforeVerification(guardian, deps);

    expect(result.status).toBe('save_failed');
    expect(deps.saveGuardian).toHaveBeenCalledTimes(1);
    expect(deps.loadRegistration).not.toHaveBeenCalled();
    expect(deps.requestVerification).not.toHaveBeenCalled();
  });

  it('reports Edge Function failure after a verified database save', async () => {
    const deps = dependencies({ requestError: 'Edge Function returned 400' });
    const result = await saveGuardianBeforeVerification(guardian, deps);

    expect(result.status).toBe('request_failed');
    expect(deps.sequence).toEqual(['save', 'read', 'request']);
  });
});

describe('guardian reviewed document versions', () => {
  it('captures the exact current versions displayed to the guardian', () => {
    expect(
      getGuardianDocumentVersions([
        { document_type: 'terms', version: 'terms-2' },
        { document_type: 'privacy', version: 'privacy-4' },
        { document_type: 'guardian_consent', version: 'guardian-3' },
      ]),
    ).toEqual({
      termsVersion: 'terms-2',
      privacyVersion: 'privacy-4',
      guardianConsentVersion: 'guardian-3',
    });
  });

  it('does not invent a version when a required document is missing', () => {
    expect(getGuardianDocumentVersions([{ document_type: 'terms', version: 'terms-2' }])).toEqual({
      termsVersion: 'terms-2',
      privacyVersion: undefined,
      guardianConsentVersion: undefined,
    });
  });
});

describe('guardian-verification Edge Function request validation', () => {
  it.each(['send', 'validate', 'decide'])('accepts the %s action', (action) => {
    expect(isGuardianAction(action)).toBe(true);
  });

  it('rejects unsupported actions', () => {
    expect(isGuardianAction('delete')).toBe(false);
    expect(isGuardianAction(undefined)).toBe(false);
  });

  it('accepts valid single-use tokens and rejects malformed tokens', () => {
    expect(isGuardianToken('a'.repeat(32))).toBe(true);
    expect(isGuardianToken('invalid token')).toBe(false);
    expect(isGuardianToken('a'.repeat(31))).toBe(false);
  });

  it('accepts only explicit Agree and Reject decisions', () => {
    expect(isGuardianDecision('agree')).toBe(true);
    expect(isGuardianDecision('reject')).toBe(true);
    expect(isGuardianDecision('yes')).toBe(false);
  });

  it('accepts ordinary valid guardian email addresses', () => {
    expect(isValidGuardianEmail('parent@example.com')).toBe(true);
    expect(isValidGuardianEmail('NINO.GOGUA+guardian@example.ge')).toBe(true);
    expect(isValidGuardianEmail('not-an-email')).toBe(false);
  });
});
