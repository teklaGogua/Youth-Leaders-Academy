import { z } from 'zod';

export const personalSchema = z.object({
  first_name: z.string().trim().min(1, 'შეიყვანეთ სახელი'),
  last_name: z.string().trim().min(1, 'შეიყვანეთ გვარი'),
  age: z.number().int().positive('მიუთითეთ ასაკი ციფრებით'),
  biography: z.string().trim().min(1, 'შეავსეთ მოკლე ბიოგრაფია').max(500, 'მაქსიმუმ 500 სიმბოლო'),
});

export const educationSchema = z.object({
  school: z.string().trim().min(1, 'შეიყვანეთ სკოლის დასახელება'),
  grade: z.string().trim().min(1, 'მიუთითეთ კლასი'),
  teacher_name: z.string().trim().min(1, 'შეიყვანეთ მასწავლებლის სახელი'),
});

export const parentSchema = z.object({
  parent_contact_name: z.string().trim().min(1, 'შეიყვანეთ საკონტაქტო პირის სახელი'),
  parent_contact_phone: z.string().trim().min(1, 'შეიყვანეთ ტელეფონის ნომერი'),
  parent_contact_email: z.string().trim().email('შეიყვანეთ მშობლის / მეურვის ელფოსტა'),
});
