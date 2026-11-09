import {
  ActionIcon,
  Button,
  Card,
  Chip,
  Group,
  Kbd,
  Loader,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { PATIENT_STATUSES, type PatientStatus, type SortField } from '@/api/types';
import { PageHeader } from '@/components/PageHeader';
import { QueryError } from '@/components/QueryError';
import { STATUS_META } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';

import { PatientTable } from './components/PatientTable';
import { usePatientStats, usePatients } from './queries';
import { PAGE_SIZES, useListParams } from './useListParams';

const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'age:asc', label: 'Youngest first' },
  { value: 'age:desc', label: 'Oldest first' },
  { value: 'last_visit:desc', label: 'Most recent visit' },
  { value: 'last_visit:asc', label: 'Longest since visit' },
  { value: 'status:asc', label: 'Status (critical first)' },
];

export default function PatientListPage() {
  usePageTitle('Patients');
  const [params, update] = useListParams();
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = usePatients(params);
  const { data: stats } = usePatientStats();

  // Press "/" anywhere on the page to jump to the search box.
  const searchRef = useRef<HTMLInputElement>(null);
  useHotkeys([['/', () => searchRef.current?.focus()]], []);

  // Search input is local state; the URL (and therefore the query) updates only after the
  // user pauses typing, so keystrokes never wait on the network.
  const [searchInput, setSearchInput] = useState(params.search ?? '');
  const [debouncedSearch] = useDebouncedValue(searchInput.trim(), 300);
  const pushedSearch = useRef(params.search ?? '');

  useEffect(() => {
    if (debouncedSearch !== pushedSearch.current) {
      pushedSearch.current = debouncedSearch;
      update({ search: debouncedSearch });
    }
  }, [debouncedSearch, update]);

  // Keep the input in sync when the URL changes from elsewhere (e.g. the back button).
  useEffect(() => {
    const fromUrl = params.search ?? '';
    if (fromUrl !== pushedSearch.current) {
      pushedSearch.current = fromUrl;
      setSearchInput(fromUrl);
    }
  }, [params.search]);

  // If the current page no longer exists (e.g. after deletions), jump to the last page.
  useEffect(() => {
    if (data && data.pages > 0 && params.page > data.pages) update({ page: data.pages });
  }, [data, params.page, update]);

  const handleSort = (field: SortField) => {
    const sameField = params.sort_by === field;
    update({
      sort_by: field,
      sort_order: sameField && params.sort_order === 'asc' ? 'desc' : 'asc',
    });
  };

  const hasFilters = Boolean(params.search) || (params.status?.length ?? 0) > 0;
  const clearFilters = () => {
    setSearchInput('');
    pushedSearch.current = '';
    update({ search: '', status: [] });
  };

  const from = data && data.total > 0 ? (data.page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(data.page * data.page_size, data.total) : 0;
  const searching = isFetching && searchInput.trim() !== (params.search ?? '');

  return (
    <>
      <PageHeader
        title="Patients"
        description={
          data
            ? `${data.total.toLocaleString()} ${hasFilters ? 'matching' : 'total'} ${data.total === 1 ? 'patient' : 'patients'}`
            : undefined
        }
        actions={
          <Button component={Link} to="/patients/new" leftSection={<IconPlus size={16} />}>
            New patient
          </Button>
        }
      />

      <Stack gap="md">
        <Group gap="sm" align="flex-end" wrap="wrap" justify="space-between">
          <TextInput
            ref={searchRef}
            aria-label="Search patients"
            placeholder="Search by name or email"
            leftSection={<IconSearch size={16} />}
            rightSectionPointerEvents="all"
            rightSection={
              searching ? (
                <Loader size="xs" />
              ) : searchInput ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Clear search"
                  onClick={() => setSearchInput('')}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : (
                <Kbd size="xs" aria-hidden visibleFrom="md">
                  /
                </Kbd>
              )
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
            w={{ base: '100%', sm: 340 }}
          />
          <Select
            aria-label="Sort by"
            data={SORT_OPTIONS}
            value={`${params.sort_by}:${params.sort_order}`}
            onChange={(value) => {
              if (!value) return;
              const [sort_by, sort_order] = value.split(':') as [SortField, 'asc' | 'desc'];
              update({ sort_by, sort_order });
            }}
            allowDeselect={false}
            hiddenFrom="sm"
            w="100%"
          />
        </Group>

        <Chip.Group
          multiple={false}
          value={params.status?.length === 1 ? params.status[0] : 'all'}
          onChange={(v) => update({ status: v === 'all' ? [] : [v as PatientStatus] })}
        >
          <Group gap="xs" wrap="nowrap" className="chip-row">
            <Chip value="all" variant="light">
              All{stats && <Count n={stats.total} />}
            </Chip>
            {PATIENT_STATUSES.map((s) => (
              <Chip key={s} value={s} variant="light" color={STATUS_META[s].color}>
                {STATUS_META[s].label}
                {stats && <Count n={stats.by_status[s]} />}
              </Chip>
            ))}
          </Group>
        </Chip.Group>

        <Card padding={0}>
          {error && !data ? (
            <div style={{ padding: 'var(--mantine-spacing-md)' }}>
              <QueryError error={error} onRetry={() => void refetch()} />
            </div>
          ) : (
            <PatientTable
              patients={data?.items}
              loading={isPending}
              stale={isPlaceholderData}
              pageSize={params.page_size}
              sortBy={params.sort_by}
              sortOrder={params.sort_order}
              onSort={handleSort}
              empty={
                <Stack align="center" gap="xs">
                  <Text fw={600}>No patients found</Text>
                  {hasFilters ? (
                    <>
                      <Text size="sm" c="dimmed">
                        Nothing matches your search and filters.
                      </Text>
                      <Button variant="light" size="xs" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Add your first patient to get started.
                    </Text>
                  )}
                </Stack>
              }
            />
          )}

          {data && data.total > 0 && (
            <Group
              justify="space-between"
              gap="sm"
              p="md"
              style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
            >
              <Text size="sm" c="dimmed" aria-live="polite">
                Showing {from}–{to} of {data.total.toLocaleString()}
              </Text>
              <Group gap="sm">
                <Select
                  aria-label="Rows per page"
                  data={PAGE_SIZES.map((s) => ({ value: String(s), label: `${s} per page` }))}
                  value={String(params.page_size)}
                  onChange={(v) => v && update({ page_size: Number(v) })}
                  allowDeselect={false}
                  w={130}
                />
                <Pagination
                  total={data.pages}
                  value={params.page}
                  onChange={(page) => update({ page })}
                  siblings={1}
                  boundaries={1}
                  getControlProps={(control) => ({
                    'aria-label': {
                      first: 'First page',
                      previous: 'Previous page',
                      next: 'Next page',
                      last: 'Last page',
                    }[control],
                  })}
                  getItemProps={(page) => ({ 'aria-label': `Page ${page}` })}
                />
              </Group>
            </Group>
          )}
        </Card>
      </Stack>
    </>
  );
}

function Count({ n }: { n: number }) {
  return (
    <Text span size="xs" c="dimmed" ml={6} className="numeric">
      {n}
    </Text>
  );
}
