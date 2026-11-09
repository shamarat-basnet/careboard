import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Page, PatientListItem } from '@/api/types';
import { jsonResponse, renderWithProviders } from '@/test/utils';

import PatientListPage from './PatientListPage';

const patient = (id: string, first: string, last: string): PatientListItem => ({
  id,
  first_name: first,
  last_name: last,
  email: null,
  date_of_birth: '1980-01-01',
  age: 46,
  blood_type: 'A+',
  status: 'active',
  last_visit: '2026-10-01',
  conditions: ['Asthma'],
});

const page = (items: PatientListItem[]): Page<PatientListItem> => ({
  items,
  total: items.length,
  page: 1,
  page_size: 20,
  pages: 1,
});

describe('PatientListPage', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname.endsWith('/stats')) {
        return jsonResponse({
          total: 2,
          by_status: { active: 2, inactive: 0, critical: 0, discharged: 0 },
          seen_last_30_days: 1,
        });
      }
      const q = url.searchParams.get('search');
      return jsonResponse(
        page(
          q
            ? [patient('2', 'Grace', 'Hopper')]
            : [patient('1', 'Ada', 'Lovelace'), patient('2', 'Grace', 'Hopper')],
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const listCalls = () =>
    fetchMock.mock.calls
      .map(([input]) => new URL(String(input), 'http://localhost'))
      .filter((u) => u.pathname === '/api/patients');

  it('renders patients from the API', async () => {
    renderWithProviders(<PatientListPage />, { route: '/patients' });
    expect(await screen.findAllByText('Lovelace, Ada')).not.toHaveLength(0);
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument();
  });

  it('debounces search into a single request', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PatientListPage />, { route: '/patients' });
    await screen.findAllByText('Lovelace, Ada');

    await user.type(screen.getByRole('textbox', { name: /search patients/i }), 'hopper');

    await waitFor(() => expect(screen.queryByText('Lovelace, Ada')).not.toBeInTheDocument());
    const searches = listCalls().filter((u) => u.searchParams.has('search'));
    expect(searches).toHaveLength(1);
    expect(searches[0]?.searchParams.get('search')).toBe('hopper');
  });

  it('reads filters and sorting from the URL', async () => {
    renderWithProviders(<PatientListPage />, {
      route: '/patients?status=critical&sort=last_visit&order=desc&page=2',
    });
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    const url = listCalls()[0]!;
    expect(url.searchParams.getAll('status')).toEqual(['critical']);
    expect(url.searchParams.get('sort_by')).toBe('last_visit');
    expect(url.searchParams.get('sort_order')).toBe('desc');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('shows status counts and filters when a chip is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PatientListPage />, { route: '/patients' });
    await screen.findAllByText('Lovelace, Ada');
    await user.click(await screen.findByRole('radio', { name: /critical/i }));
    await waitFor(() =>
      expect(listCalls().some((u) => u.searchParams.get('status') === 'critical')).toBe(true),
    );
  });

  it('shows a retryable error when the server is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderWithProviders(<PatientListPage />, { route: '/patients' });
    expect(await screen.findByText('Connection problem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
