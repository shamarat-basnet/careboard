import type { PatientStatus } from '@/api/types';

/** Parse a date-only ISO string (YYYY-MM-DD) as a *local* date, avoiding UTC off-by-one. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayIso(): string {
  return toDateOnlyIso(new Date());
}

export function toDateOnlyIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Value for an <input type="datetime-local"> in local time. */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateOnlyIso(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const relativeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatDate(value: string | null | undefined): string {
  return value ? dateFmt.format(parseDateOnly(value)) : '—';
}

export function formatDateTime(value: string): string {
  return dateTimeFmt.format(new Date(value));
}

export function formatRelativeDays(value: string | null, now = new Date()): string {
  if (!value) return 'Never';
  const day = 24 * 60 * 60 * 1000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((parseDateOnly(value).getTime() - today.getTime()) / day);
  if (Math.abs(days) < 30) return relativeFmt.format(days, 'day');
  if (Math.abs(days) < 365) return relativeFmt.format(Math.round(days / 30), 'month');
  return relativeFmt.format(Math.round(days / 365), 'year');
}

export function ageFrom(dateOfBirth: string, now = new Date()): number {
  const dob = parseDateOnly(dateOfBirth);
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export const STATUS_META: Record<PatientStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'green' },
  inactive: { label: 'Inactive', color: 'gray' },
  critical: { label: 'Critical', color: 'red' },
  discharged: { label: 'Discharged', color: 'blue' },
};
