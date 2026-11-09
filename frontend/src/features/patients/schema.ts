import { z } from 'zod';

import { BLOOD_TYPES, PATIENT_STATUSES, type Patient, type PatientInput } from '@/api/types';
import { ageFrom, todayIso } from '@/lib/format';

// These rules mirror backend/app/schemas/patient.py so users get instant feedback; the server
// remains the source of truth and its 422 responses are mapped back onto the same fields.
const NAME_RE = /^\p{L}[\p{L} '.-]*$/u;
const PHONE_RE = /^\+?[0-9 ()\-.]{7,20}$/;
const MAX_AGE = 130;

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be at most 100 characters`)
    .regex(NAME_RE, 'Use letters, spaces, hyphens, apostrophes or periods only');

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

const clinicalList = z
  .array(z.string().trim().min(1).max(100, 'Each entry must be at most 100 characters'))
  .max(50, 'At most 50 entries');

export const patientFormSchema = z
  .object({
    first_name: name('First name'),
    last_name: name('Last name'),
    date_of_birth: z
      .string()
      .min(1, 'Date of birth is required')
      .refine((v) => v <= todayIso(), 'Date of birth cannot be in the future')
      .refine((v) => ageFrom(v) <= MAX_AGE, `Age cannot exceed ${MAX_AGE} years`),
    email: z
      .string()
      .trim()
      .max(255)
      .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email'),
    phone: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || (PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 7),
        'Enter a valid phone number, e.g. +1 (555) 123-4567',
      ),
    address_line1: optionalText('Address', 200),
    address_line2: optionalText('Address', 200),
    city: optionalText('City', 100),
    state: optionalText('State', 100),
    postal_code: optionalText('Postal code', 20),
    blood_type: z.enum(BLOOD_TYPES),
    status: z.enum(PATIENT_STATUSES),
    allergies: clinicalList,
    conditions: clinicalList,
    last_visit: z
      .string()
      .refine((v) => v === '' || v <= todayIso(), 'Last visit cannot be in the future'),
  })
  .superRefine((values, ctx) => {
    if (values.last_visit && values.date_of_birth && values.last_visit < values.date_of_birth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['last_visit'],
        message: 'Last visit cannot be before the date of birth',
      });
    }
  });

export type PatientFormValues = z.infer<typeof patientFormSchema>;
export type PatientFormField = keyof PatientFormValues;

export const emptyPatientForm: PatientFormValues = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  blood_type: 'unknown',
  status: 'active',
  allergies: [],
  conditions: [],
  last_visit: '',
};

const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim());

export function toPatientInput(v: PatientFormValues): PatientInput {
  return {
    ...v,
    email: blankToNull(v.email),
    phone: blankToNull(v.phone),
    address_line1: blankToNull(v.address_line1),
    address_line2: blankToNull(v.address_line2),
    city: blankToNull(v.city),
    state: blankToNull(v.state),
    postal_code: blankToNull(v.postal_code),
    last_visit: blankToNull(v.last_visit),
  };
}

export function fromPatient(p: Patient): PatientFormValues {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    email: p.email ?? '',
    phone: p.phone ?? '',
    address_line1: p.address_line1 ?? '',
    address_line2: p.address_line2 ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    postal_code: p.postal_code ?? '',
    blood_type: p.blood_type,
    status: p.status,
    allergies: p.allergies,
    conditions: p.conditions,
    last_visit: p.last_visit ?? '',
  };
}

export const PATIENT_FORM_FIELDS = Object.keys(emptyPatientForm) as PatientFormField[];
