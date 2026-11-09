import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { patientsApi } from '@/api/patients';
import type {
  Note,
  NoteInput,
  PatientInput,
  PatientListParams,
  PatientUpdateInput,
} from '@/api/types';

/** Hierarchical keys so related caches can be invalidated together. */
export const patientKeys = {
  all: ['patients'] as const,
  lists: () => [...patientKeys.all, 'list'] as const,
  list: (params: PatientListParams) => [...patientKeys.lists(), params] as const,
  stats: () => [...patientKeys.all, 'stats'] as const,
  detail: (id: string) => [...patientKeys.all, 'detail', id] as const,
  notes: (id: string) => [...patientKeys.detail(id), 'notes'] as const,
  summary: (id: string) => [...patientKeys.detail(id), 'summary'] as const,
};

export function usePatients(params: PatientListParams) {
  return useQuery({
    queryKey: patientKeys.list(params),
    queryFn: ({ signal }) => patientsApi.list(params, signal),
    // Keep showing the current page while the next one loads: no flicker, non-blocking search.
    placeholderData: keepPreviousData,
  });
}

export function usePatientStats() {
  return useQuery({
    queryKey: patientKeys.stats(),
    queryFn: ({ signal }) => patientsApi.stats(signal),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: patientKeys.detail(id),
    queryFn: ({ signal }) => patientsApi.get(id, signal),
  });
}

export function prefetchPatient(queryClient: QueryClient, id: string) {
  return queryClient.prefetchQuery({
    queryKey: patientKeys.detail(id),
    queryFn: ({ signal }) => patientsApi.get(id, signal),
    staleTime: 30_000,
  });
}

export function useNotes(patientId: string) {
  return useQuery({
    queryKey: patientKeys.notes(patientId),
    queryFn: ({ signal }) => patientsApi.notes.list(patientId, signal),
  });
}

export function usePatientSummary(patientId: string) {
  return useQuery({
    queryKey: patientKeys.summary(patientId),
    queryFn: ({ signal }) => patientsApi.summary(patientId, signal),
    // Mutations invalidate this key; otherwise don't re-run generation (it may call an LLM).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PatientInput) => patientsApi.create(data),
    onSuccess: (patient) => {
      qc.setQueryData(patientKeys.detail(patient.id), patient);
      void qc.invalidateQueries({ queryKey: patientKeys.lists() });
      void qc.invalidateQueries({ queryKey: patientKeys.stats() });
    },
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PatientUpdateInput) => patientsApi.update(id, data),
    onSuccess: (patient) => {
      qc.setQueryData(patientKeys.detail(id), patient);
      void qc.invalidateQueries({ queryKey: patientKeys.summary(id) });
      void qc.invalidateQueries({ queryKey: patientKeys.lists() });
      void qc.invalidateQueries({ queryKey: patientKeys.stats() });
    },
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientsApi.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: patientKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: patientKeys.lists() });
      void qc.invalidateQueries({ queryKey: patientKeys.stats() });
    },
  });
}

export function useAddNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NoteInput) => patientsApi.notes.create(patientId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: patientKeys.notes(patientId) });
      void qc.invalidateQueries({ queryKey: patientKeys.summary(patientId) });
    },
  });
}

/** Optimistically removes the note, rolling back if the server rejects the delete. */
export function useDeleteNote(patientId: string) {
  const qc = useQueryClient();
  const key = patientKeys.notes(patientId);
  return useMutation({
    mutationFn: (noteId: string) => patientsApi.notes.remove(patientId, noteId),
    onMutate: async (noteId) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Note[]>(key);
      qc.setQueryData<Note[]>(key, (notes) => notes?.filter((n) => n.id !== noteId));
      return { previous };
    },
    onError: (_err, _noteId, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: patientKeys.summary(patientId) });
    },
  });
}
