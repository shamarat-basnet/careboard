// Mirrors the backend's Pydantic schemas (see backend/app/schemas). In a larger codebase these
// would be generated from the OpenAPI spec (e.g. with openapi-typescript) to prevent drift.

export const PATIENT_STATUSES = ['active', 'inactive', 'critical', 'discharged'] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const SORT_FIELDS = ['name', 'age', 'last_visit', 'status'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PatientListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  date_of_birth: string;
  age: number;
  blood_type: BloodType;
  status: PatientStatus;
  last_visit: string | null;
  conditions: string[];
}

export interface PatientInput {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  blood_type: BloodType;
  status: PatientStatus;
  allergies: string[];
  conditions: string[];
  last_visit: string | null;
}

/** PUT payload: the `updated_at` the client loaded, so the server can reject stale edits (409). */
export type PatientUpdateInput = PatientInput & { updated_at: string };

export interface Patient extends PatientInput {
  id: string;
  age: number;
  created_at: string;
  updated_at: string;
}

export interface PatientListParams {
  page: number;
  page_size: number;
  search?: string;
  status?: PatientStatus[];
  sort_by: SortField;
  sort_order: SortOrder;
}

export interface PatientStats {
  total: number;
  by_status: Record<PatientStatus, number>;
  seen_last_30_days: number;
}

export interface Note {
  id: string;
  patient_id: string;
  timestamp: string;
  content: string;
  created_at: string;
}

export interface NoteInput {
  content: string;
  timestamp?: string;
}

export interface PatientSummary {
  patient_id: string;
  identifiers: { name: string; age: number; date_of_birth: string; blood_type: string };
  status: PatientStatus;
  conditions: string[];
  allergies: string[];
  last_visit: string | null;
  note_count: number;
  narrative: string;
  source: 'template' | 'llm';
  generated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface FieldError {
  field: string;
  message: string;
}
