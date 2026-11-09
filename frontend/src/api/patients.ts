import { request } from './client';
import type {
  Note,
  NoteInput,
  Page,
  Patient,
  PatientInput,
  PatientListItem,
  PatientListParams,
  PatientUpdateInput,
  PatientStats,
  PatientSummary,
} from './types';

export const patientsApi = {
  list: (params: PatientListParams, signal?: AbortSignal) =>
    request<Page<PatientListItem>>('/patients', { query: { ...params }, signal }),
  stats: (signal?: AbortSignal) => request<PatientStats>('/patients/stats', { signal }),
  get: (id: string, signal?: AbortSignal) => request<Patient>(`/patients/${id}`, { signal }),
  create: (data: PatientInput) => request<Patient>('/patients', { method: 'POST', body: data }),
  update: (id: string, data: PatientUpdateInput) =>
    request<Patient>(`/patients/${id}`, { method: 'PUT', body: data }),
  remove: (id: string) => request<void>(`/patients/${id}`, { method: 'DELETE' }),
  summary: (id: string, signal?: AbortSignal) =>
    request<PatientSummary>(`/patients/${id}/summary`, { signal }),

  notes: {
    list: (patientId: string, signal?: AbortSignal) =>
      request<Note[]>(`/patients/${patientId}/notes`, { signal }),
    create: (patientId: string, data: NoteInput) =>
      request<Note>(`/patients/${patientId}/notes`, { method: 'POST', body: data }),
    remove: (patientId: string, noteId: string) =>
      request<void>(`/patients/${patientId}/notes/${noteId}`, { method: 'DELETE' }),
  },
};
