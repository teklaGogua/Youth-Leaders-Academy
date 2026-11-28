import { z } from 'zod';
import type { AppRole } from '../../lib/database.types';

export const loginSchema = z.object({
  email: z.string().trim().email('შეიყვანეთ სწორი ელფოსტა'),
  password: z.string().min(1, 'შეიყვანეთ პაროლი'),
});

export const registrationSchema = z
  .object({
    firstName: z.string().trim().min(2, 'სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს'),
    lastName: z.string().trim().min(2, 'გვარი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს'),
    email: z.string().trim().email('შეიყვანეთ სწორი ელფოსტა'),
    password: z.string().min(8, 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს'),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'პაროლები ერთმანეთს არ ემთხვევა',
    path: ['passwordConfirmation'],
  });

export const recoverySchema = z.object({
  email: z.string().trim().email('შეიყვანეთ სწორი ელფოსტა'),
});

export const passwordResetSchema = z
  .object({
    password: z.string().min(8, 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს'),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'პაროლები ერთმანეთს არ ემთხვევა',
    path: ['passwordConfirmation'],
  });

export function getHomeRouteForRole(_role: AppRole): string {
  return '/';
}

export function isSafeRedirectPath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}
