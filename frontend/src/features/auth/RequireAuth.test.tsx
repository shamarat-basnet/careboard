import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorResponse, jsonResponse } from '@/test/utils';

import { useLogout } from './queries';
import { RequireAuth } from './RequireAuth';

function SignOutButton() {
  const logout = useLogout();
  return <button onClick={() => logout.mutate()}>Sign out</button>;
}

function renderApp() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login page</p> },
      { element: <RequireAuth />, children: [{ path: '/', element: <SignOutButton /> }] },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('RequireAuth', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends signed-out visitors to the login page', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'unauthorized', 'Please sign in.'));
    renderApp();
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('returns to the login page as soon as the user signs out', async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('/auth/logout')
        ? new Response(null, { status: 204 })
        : jsonResponse({ id: '1', email: 'doc@example.com', name: 'Dr. Doc' }),
    );
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument());
  });
});
