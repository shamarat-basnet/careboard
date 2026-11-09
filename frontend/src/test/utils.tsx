import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { theme } from '@/app/theme';

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '*' }: { route?: string; path?: string } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // A data router (not <MemoryRouter>) because the form uses useBlocker.
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries: [route] });
  return render(
    // env="test" turns off animations so modals open and close instantly.
    <MantineProvider theme={theme} env="test">
      <QueryClientProvider client={queryClient}>
        <ModalsProvider>
          <RouterProvider router={router} />
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const errorResponse = (status: number, code: string, message: string) =>
  jsonResponse({ error: { code, message, fields: [] } }, status);
