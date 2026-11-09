import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorResponse, jsonResponse, renderWithProviders } from '@/test/utils';

import LoginPage from './LoginPage';

describe('LoginPage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const attempt = async (email = 'doc@example.com', password = 'wrong-password') => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });
    await user.type(await screen.findByLabelText(/email/i), email);
    await user.type(screen.getByLabelText(/password/i), password);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
  };

  // First call is the "who am I" check on page load: nobody is signed in yet.
  const signedOut = () =>
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'unauthorized', 'Please sign in.'));

  it('shows the server message for wrong credentials', async () => {
    signedOut();
    fetchMock.mockResolvedValueOnce(
      errorResponse(401, 'invalid_credentials', 'Incorrect email or password.'),
    );
    await attempt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });

  it('tells the user when the account is locked', async () => {
    signedOut();
    fetchMock.mockResolvedValueOnce(
      errorResponse(429, 'too_many_attempts', 'Too many failed attempts. Try again in 15 minutes.'),
    );
    await attempt();
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many failed attempts/i);
  });

  it('sends the credentials once and signs in', async () => {
    signedOut();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: '1', email: 'doc@example.com', name: 'Dr. Doc' }),
    );
    await attempt('doc@example.com', 'correct-horse-battery');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe('/api/auth/login');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'doc@example.com',
      password: 'correct-horse-battery',
    });
  });
});
