import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Note } from '@/api/types';
import { errorResponse, jsonResponse, renderWithProviders } from '@/test/utils';

import { PatientNotes } from './PatientNotes';

const note = (id: string, content: string): Note => ({
  id,
  patient_id: 'p1',
  content,
  timestamp: '2026-11-01T09:00:00Z',
  created_at: '2026-11-01T09:00:00Z',
});

describe('PatientNotes', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the note when the server refuses to delete it', async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'DELETE'
        ? errorResponse(500, 'internal_error', 'An unexpected error occurred.')
        : jsonResponse([note('n1', 'First note'), note('n2', 'Second note')]),
    );
    const user = userEvent.setup();
    renderWithProviders(<PatientNotes patientId="p1" />);

    await screen.findByText('First note');
    await user.click(screen.getAllByRole('button', { name: /delete note/i })[0]!);
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true),
    );
    // Rolled back / refetched: both notes are still there.
    await waitFor(() => expect(screen.getByText('First note')).toBeInTheDocument());
    expect(screen.getByText('Second note')).toBeInTheDocument();
  });
});
