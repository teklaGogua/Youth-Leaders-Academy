export type AuthErrorLike = { status?: number; code?: string; message?: string };

export function getGeorgianAuthError(
  error: unknown,
  action: 'register' | 'login' | 'recovery' | 'password',
): string {
  const candidate = (error && typeof error === 'object' ? error : {}) as AuthErrorLike;
  const message = (candidate.message ?? '').toLowerCase();
  const code = (candidate.code ?? '').toLowerCase();

  if (
    candidate.status === 429 ||
    code.includes('rate') ||
    code.includes('too_many') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over_email_send_rate_limit')
  ) {
    return action === 'recovery'
      ? 'ძალიან ბევრი მოთხოვნა გაიგზავნა. ცოტა ხნით დაელოდეთ და სცადეთ ხელახლა.'
      : 'ძალიან ბევრი მცდელობაა. ცოტა ხნით დაელოდეთ და სცადეთ ხელახლა.';
  }

  if (
    action === 'register' &&
    (code.includes('user_already') ||
      message.includes('already registered') ||
      message.includes('already exists'))
  ) {
    return 'ამ ელფოსტით ანგარიში უკვე არსებობს. სცადეთ შესვლა ან პაროლის აღდგენა.';
  }

  if (
    action === 'login' &&
    (code.includes('invalid_credentials') || message.includes('invalid login credentials'))
  ) {
    return 'ელფოსტა ან პაროლი არასწორია. გადაამოწმეთ მონაცემები.';
  }

  if (action === 'recovery') return 'მოთხოვნის გაგზავნა ვერ მოხერხდა. სცადეთ მოგვიანებით.';
  if (action === 'password') return 'პაროლის შეცვლა ვერ მოხერხდა. მოითხოვეთ ახალი აღდგენის ბმული.';
  if (action === 'register') return 'ანგარიშის შექმნა ვერ მოხერხდა. გადაამოწმეთ მონაცემები და სცადეთ ხელახლა.';

  return 'შესვლა ვერ მოხერხდა. გადაამოწმეთ მონაცემები და სცადეთ ხელახლა.';
}
