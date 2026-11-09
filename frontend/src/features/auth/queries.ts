import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';

export const meKey = ['me'] as const;

/** The signed-in user, or `null` when nobody is signed in. Other failures (server down) throw. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async ({ signal }) => {
      try {
        return await authApi.me(signal);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** Forget all cached data except the signed-in user, which the route guard is watching. */
function forgetCachedData(qc: QueryClient) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) => authApi.login(v.email, v.password),
    onSuccess: (user) => {
      forgetCachedData(qc); // never show one user's cached data to the next
      qc.setQueryData(meKey, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    // Drop all cached patient data even if the request failed: the user asked to leave.
    onSettled: () => {
      forgetCachedData(qc);
      qc.setQueryData(meKey, null);
    },
  });
}
