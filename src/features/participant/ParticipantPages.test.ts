import { describe, expect, it } from 'vitest';
import { educationSchema, parentSchema, personalSchema } from './registration.schemas';

const validPersonal = {
  first_name: 'ნინო',
  last_name: 'ტესტი',
  age: 16,
  biography: 'სინთეზური სატესტო ბიოგრაფია',
};

describe('participant registration validation', () => {
  it('accepts complete personal details', () => {
    expect(personalSchema.safeParse(validPersonal).success).toBe(true);
  });

  it('requires a positive whole-number age and a biography', () => {
    expect(personalSchema.safeParse({ ...validPersonal, age: null }).success).toBe(false);
    expect(personalSchema.safeParse({ ...validPersonal, age: 0 }).success).toBe(false);
    expect(personalSchema.safeParse({ ...validPersonal, age: 16.5 }).success).toBe(false);
    expect(personalSchema.safeParse({ ...validPersonal, biography: '' }).success).toBe(false);
  });

  it('enforces the 500-character temporary biography limit', () => {
    expect(personalSchema.safeParse({ ...validPersonal, biography: 'ა'.repeat(501) }).success).toBe(
      false,
    );
  });

  it('requires all education fields', () => {
    expect(
      educationSchema.safeParse({ school: 'სკოლა', grade: '10', teacher_name: 'მასწავლებელი' })
        .success,
    ).toBe(true);
    expect(
      educationSchema.safeParse({ school: '', grade: '10', teacher_name: 'მასწავლებელი' }).success,
    ).toBe(false);
  });

  it('requires a valid parent or guardian email address', () => {
    const required = { parent_contact_name: 'მშობელი', parent_contact_phone: '+995555000000' };
    expect(
      parentSchema.safeParse({ ...required, parent_contact_email: 'guardian@example.test' })
        .success,
    ).toBe(true);
    expect(parentSchema.safeParse({ ...required, parent_contact_email: '' }).success).toBe(false);
    expect(parentSchema.safeParse({ ...required, parent_contact_email: 'bad-email' }).success).toBe(
      false,
    );
  });
});
