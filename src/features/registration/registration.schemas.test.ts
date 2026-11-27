import { describe, expect, it } from 'vitest';
import {
  educationSchema,
  guardianSchema,
  legalAgreementsSchema,
  personalInformationSchema,
} from './registration.schemas';

describe('participant registration validation', () => {
  it('requires valid personal information and a positive integer age', () => {
    expect(personalInformationSchema.safeParse({
      firstName: 'ანა', lastName: 'ბერიძე', age: 15, biography: 'მიყვარს სწავლა და მოხალისეობა.',
    }).success).toBe(true);
    expect(personalInformationSchema.safeParse({
      firstName: '', lastName: 'ბერიძე', age: 0, biography: 'მოკლე',
    }).success).toBe(false);
  });

  it('requires school, grade and teacher details', () => {
    expect(educationSchema.safeParse({
      school: 'სკოლა N1', grade: '10', teacherName: 'ნინო მასწავლებელი',
    }).success).toBe(true);
    expect(educationSchema.safeParse({ school: '', grade: '', teacherName: '' }).success).toBe(false);
  });

  it('requires a guardian for every participant', () => {
    expect(guardianSchema.safeParse({
      guardianFullName: 'მარიამ ბერიძე', guardianPhone: '+995555123456',
      guardianEmail: 'parent@example.com',
    }).success).toBe(true);
    expect(guardianSchema.safeParse({
      guardianFullName: '', guardianPhone: '', guardianEmail: '',
    }).success).toBe(false);
  });

  it('requires separate acceptance of Terms and Privacy Policy', () => {
    expect(legalAgreementsSchema.safeParse({ termsAccepted: true, privacyAccepted: true }).success).toBe(true);
    expect(legalAgreementsSchema.safeParse({ termsAccepted: true, privacyAccepted: false }).success).toBe(false);
  });
});
