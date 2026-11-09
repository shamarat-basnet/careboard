import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { meKey } from '@/features/auth/queries';

export function createQueryClient() {
  // A "please sign in" answer from any request means the session ended (expired, logged out
  // elsewhere): mark nobody as signed in, and the route guard sends the user to /login.
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'unauthorized') {
      queryClient.setQueryData(meKey, null);
    }
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry transient failures (network, 5xx) but never client errors like 401/404/422.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
  return queryClient;
}
