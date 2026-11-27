import { z } from 'zod';

const requiredText = (label: string, minimum = 2) =>
  z.string().trim().min(minimum, label).max(1000, 'ტექსტი ძალიან გრძელია');

export const personalInformationSchema = z.object({
  firstName: requiredText('შეიყვანეთ სახელი'),
  lastName: requiredText('შეიყვანეთ გვარი'),
  age: z.coerce.number().int('ასაკი უნდა იყოს მთელი რიცხვი').min(1, 'შეიყვანეთ სწორი ასაკი').max(100),
  biography: z.string().trim().min(10, 'ბიოგრაფია უნდა შეიცავდეს მინიმუმ 10 სიმბოლოს').max(1500),
});

export const educationSchema = z.object({
  school: requiredText('შეიყვანეთ სკოლის დასახელება'),
  grade: z.string().trim().min(1, 'შეიყვანეთ კლასი').max(30),
  teacherName: requiredText('შეიყვანეთ მასწავლებლის სახელი', 2),
});

export const guardianSchema = z.object({
  guardianFullName: requiredText('შეიყვანეთ მშობლის/მეურვის სრული სახელი', 3),
  guardianPhone: z.string().trim().min(6, 'შეიყვანეთ სწორი ტელეფონის ნომერი').max(40),
  guardianEmail: z.string().trim().email('შეიყვანეთ სწორი ელფოსტა'),
});

export const legalAgreementsSchema = z.object({
  termsAccepted: z.literal(true, { error: 'თანხმობა აუცილებელია' }),
  privacyAccepted: z.literal(true, { error: 'თანხმობა აუცილებელია' }),
});

export type RegistrationFormValues = {
  firstName: string;
  lastName: string;
  age: string;
  biography: string;
  school: string;
  grade: string;
  teacherName: string;
  guardianFullName: string;
  guardianPhone: string;
  guardianEmail: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export const emptyRegistrationForm: RegistrationFormValues = {
  firstName: '',
  lastName: '',
  age: '',
  biography: '',
  school: '',
  grade: '',
  teacherName: '',
  guardianFullName: '',
  guardianPhone: '',
  guardianEmail: '',
  termsAccepted: false,
  privacyAccepted: false,
};
