import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from '@/api/client';
import { renderWithProviders } from '@/test/utils';

import { PatientForm } from './PatientForm';

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  renderWithProviders(
    <PatientForm submitLabel="Create patient" onSubmit={onSubmit} onCancel={vi.fn()} />,
  );
  return { onSubmit, user: userEvent.setup() };
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), 'Ada');
  await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
  await user.type(screen.getByLabelText(/date of birth/i), '1985-12-10');
}

describe('PatientForm', () => {
  it('shows client-side errors and does not submit invalid data', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /create patient/i }));

    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Date of birth is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a normalised payload', async () => {
    const { onSubmit, user } = setup();
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /create patient/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      first_name: 'Ada',
      last_name: 'Lovelace',
      date_of_birth: '1985-12-10',
      email: null,
      last_visit: null,
      status: 'active',
      blood_type: 'unknown',
    });
  });

  it('maps server validation errors onto fields', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(422, 'validation_error', 'Invalid', [
          { field: 'phone', message: 'must be a valid phone number' },
        ]),
      );
    const { user } = setup(onSubmit);
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /create patient/i }));

    expect(await screen.findByText('must be a valid phone number')).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a connection banner on network failure and keeps the input', async () => {
    const { user } = setup(vi.fn().mockRejectedValue(new NetworkError()));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /create patient/i }));

    expect(await screen.findByText('Connection problem')).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada');
  });

  it('shows the server message when someone else changed the record (409)', async () => {
    const msg = 'This patient was changed by someone else since you opened it.';
    const { user } = setup(vi.fn().mockRejectedValue(new ApiError(409, 'conflict', msg)));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /create patient/i }));

    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada');
  });
});
