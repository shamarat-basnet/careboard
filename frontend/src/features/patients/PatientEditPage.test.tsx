import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Patient } from '@/api/types';
import { errorResponse, jsonResponse, renderWithProviders } from '@/test/utils';

import PatientEditPage from './PatientEditPage';

const patient: Patient = {
  id: 'p1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  date_of_birth: '1985-12-10',
  age: 40,
  email: null,
  phone: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  postal_code: null,
  blood_type: 'A+',
  status: 'active',
  allergies: [],
  conditions: [],
  last_visit: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00.123456Z',
};

describe('PatientEditPage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the loaded version, and on a conflict keeps what the user typed', async () => {
    const message = 'This patient was changed by someone else since you opened it.';
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'PUT' ? errorResponse(409, 'conflict', message) : jsonResponse(patient),
    );
    const user = userEvent.setup();
    renderWithProviders(<PatientEditPage />, {
      route: '/patients/p1/edit',
      path: '/patients/:id/edit',
    });

    const first = await screen.findByLabelText(/first name/i);
    await user.clear(first);
    await user.type(first, 'Augusta');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Augusta');
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(JSON.parse(String(put[1]?.body)).updated_at).toBe(patient.updated_at);
  });
});
