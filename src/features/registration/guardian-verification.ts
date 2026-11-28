import { guardianSchema, type RegistrationFormValues } from './registration.schemas';

type GuardianDetails = Pick<
  RegistrationFormValues,
  'guardianFullName' | 'guardianPhone' | 'guardianEmail'
>;

export type SavedGuardianRegistration = {
  user_id: string;
  guardian_full_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  step_3_completed_at: string | null;
};

type GuardianVerificationDependencies = {
  participantId: string;
  saveGuardian: (guardian: GuardianDetails) => Promise<{ error: string | null }>;
  loadRegistration: () => Promise<{
    data: SavedGuardianRegistration | null;
    error: string | null;
  }>;
  requestVerification: (identifiers: {
    participantId: string;
    registrationId: string;
  }) => Promise<{ error: string | null }>;
};

export type GuardianVerificationResult =
  | { status: 'invalid'; message: string }
  | { status: 'save_failed' }
  | { status: 'read_failed' }
  | { status: 'saved_record_mismatch' }
  | { status: 'request_failed'; registration: SavedGuardianRegistration }
  | { status: 'sent'; registration: SavedGuardianRegistration };

export async function saveGuardianBeforeVerification(
  values: GuardianDetails,
  dependencies: GuardianVerificationDependencies,
): Promise<GuardianVerificationResult> {
  const parsed = guardianSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: 'invalid',
      message: parsed.error.issues[0]?.message ?? 'შეამოწმეთ მშობლის/მეურვის მონაცემები.',
    };
  }

  const guardian = {
    guardianFullName: parsed.data.guardianFullName,
    guardianPhone: parsed.data.guardianPhone,
    guardianEmail: parsed.data.guardianEmail.toLowerCase(),
  };
  try {
    const saveResult = await dependencies.saveGuardian(guardian);
    if (saveResult.error) return { status: 'save_failed' };
  } catch {
    return { status: 'save_failed' };
  }

  let registrationResult: Awaited<ReturnType<typeof dependencies.loadRegistration>>;
  try {
    registrationResult = await dependencies.loadRegistration();
  } catch {
    return { status: 'read_failed' };
  }
  if (registrationResult.error) return { status: 'read_failed' };

  const registration = registrationResult.data;
  if (
    !registration ||
    registration.user_id !== dependencies.participantId ||
    !registration.step_3_completed_at ||
    registration.guardian_full_name !== guardian.guardianFullName ||
    registration.guardian_phone !== guardian.guardianPhone ||
    registration.guardian_email !== guardian.guardianEmail
  ) {
    return { status: 'saved_record_mismatch' };
  }

  try {
    const requestResult = await dependencies.requestVerification({
      participantId: dependencies.participantId,
      registrationId: registration.user_id,
    });
    if (requestResult.error) return { status: 'request_failed', registration };
  } catch {
    return { status: 'request_failed', registration };
  }

  return { status: 'sent', registration };
}

export type GuardianDocumentVersions = {
  termsVersion: string | undefined;
  privacyVersion: string | undefined;
  guardianConsentVersion: string | undefined;
};

export function getGuardianDocumentVersions(
  documents: Array<{ document_type: string; version: string }>,
): GuardianDocumentVersions {
  return {
    termsVersion: documents.find((document) => document.document_type === 'terms')?.version,
    privacyVersion: documents.find((document) => document.document_type === 'privacy')?.version,
    guardianConsentVersion: documents.find(
      (document) => document.document_type === 'guardian_consent',
    )?.version,
  };
}
