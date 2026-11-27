import type { ParticipantRegistration } from '../../lib/database.types';

export type RegistrationProgressState = Pick<
  ParticipantRegistration,
  | 'step_1_completed_at'
  | 'step_2_completed_at'
  | 'step_3_completed_at'
  | 'guardian_verified_at'
  | 'guardian_verified_email'
  | 'guardian_email'
>;

export function getNextRegistrationStep(
  registration: RegistrationProgressState | null,
): 1 | 2 | 3 | 4 {
  if (!registration?.step_1_completed_at) return 1;
  if (!registration.step_2_completed_at) return 2;
  if (
    !registration.step_3_completed_at ||
    !registration.guardian_verified_at ||
    registration.guardian_verified_email !== registration.guardian_email
  ) {
    return 3;
  }
  return 4;
}
