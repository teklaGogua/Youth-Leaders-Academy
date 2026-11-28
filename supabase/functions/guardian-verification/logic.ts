export type GuardianAction = 'send' | 'validate' | 'decide';

export function isGuardianAction(value: unknown): value is GuardianAction {
  return value === 'send' || value === 'validate' || value === 'decide';
}

export function isGuardianToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export function isGuardianDecision(value: unknown): value is 'agree' | 'reject' {
  return value === 'agree' || value === 'reject';
}

export function isValidGuardianEmail(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
  );
}
