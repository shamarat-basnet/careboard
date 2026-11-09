import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import {
  PATIENT_STATUSES,
  SORT_FIELDS,
  type PatientListParams,
  type PatientStatus,
  type SortField,
  type SortOrder,
} from '@/api/types';

export const PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULTS = { page: 1, page_size: 20, sort_by: 'name', sort_order: 'asc' } as const;

const isStatus = (v: string): v is PatientStatus =>
  (PATIENT_STATUSES as readonly string[]).includes(v);
const isSortField = (v: string | null): v is SortField =>
  v !== null && (SORT_FIELDS as readonly string[]).includes(v);

/**
 * List state (page, search, filters, sort) lives in the URL so it survives reloads, can be
 * shared as a link, and works with the browser's back button. Invalid values fall back to
 * defaults rather than producing API errors.
 */
export function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<PatientListParams>(() => {
    const page = Number(searchParams.get('page'));
    const size = Number(searchParams.get('size'));
    const sort = searchParams.get('sort');
    const order = searchParams.get('order');
    return {
      page: Number.isInteger(page) && page > 0 ? page : DEFAULTS.page,
      page_size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULTS.page_size,
      search: searchParams.get('q') ?? '',
      status: searchParams.getAll('status').filter(isStatus),
      sort_by: isSortField(sort) ? sort : DEFAULTS.sort_by,
      sort_order: order === 'desc' || order === 'asc' ? (order as SortOrder) : DEFAULTS.sort_order,
    };
  }, [searchParams]);

  const update = useCallback(
    (patch: Partial<PatientListParams>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          // Store a value in the URL only when it differs from the default.
          const put = (key: string, value: string | number, fallback: string | number) =>
            value === fallback ? next.delete(key) : next.set(key, String(value));

          if (patch.search !== undefined) put('q', patch.search, '');
          if (patch.status) {
            next.delete('status');
            patch.status.forEach((s) => next.append('status', s));
          }
          if (patch.sort_by) put('sort', patch.sort_by, DEFAULTS.sort_by);
          if (patch.sort_order) put('order', patch.sort_order, DEFAULTS.sort_order);
          if (patch.page_size) put('size', patch.page_size, DEFAULTS.page_size);
          // Any change other than paging itself sends the user back to page 1.
          put('page', patch.page ?? 1, 1);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [params, update] as const;
}
