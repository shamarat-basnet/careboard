import {
  Anchor,
  Avatar,
  Badge,
  Card,
  Center,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { memo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import type { PatientListItem, SortField, SortOrder } from '@/api/types';
import { formatDate, formatRelativeDays } from '@/lib/format';

import { prefetchPatient } from '../queries';
import { StatusBadge } from './StatusBadge';

interface SortProps {
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

function SortableTh({
  field,
  children,
  sortBy,
  sortOrder,
  onSort,
  ...rest
}: SortProps & { field: SortField; children: ReactNode } & Omit<
    React.ComponentProps<typeof Table.Th>,
    'children'
  >) {
  const active = sortBy === field;
  const Icon = active ? (sortOrder === 'asc' ? IconArrowUp : IconArrowDown) : IconArrowsSort;
  return (
    <Table.Th
      aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      {...rest}
    >
      <UnstyledButton className="sort-button" onClick={() => onSort(field)}>
        <Group gap={4} wrap="nowrap">
          <Text fw={600} size="sm" c={active ? undefined : 'dimmed'}>
            {children}
          </Text>
          <Icon size={14} opacity={active ? 1 : 0.45} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function displayName(p: PatientListItem) {
  return `${p.last_name}, ${p.first_name}`;
}

function Conditions({ conditions }: { conditions: string[] }) {
  if (conditions.length === 0)
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  const [first, ...rest] = conditions;
  return (
    <Tooltip label={conditions.join(', ')} disabled={rest.length === 0} multiline maw={260}>
      <Group gap={6} wrap="nowrap">
        <Badge variant="outline" color="gray" tt="none" fw={500} maw={170}>
          {first}
        </Badge>
        {rest.length > 0 && (
          <Text size="xs" c="dimmed" span>
            +{rest.length}
          </Text>
        )}
      </Group>
    </Tooltip>
  );
}

/** Memoised so a page change only re-renders rows whose data actually changed. */
const PatientRow = memo(function PatientRow({
  patient,
  showMore,
  showConditions,
  onOpen,
  onIntent,
}: {
  patient: PatientListItem;
  showMore: boolean;
  showConditions: boolean;
  onOpen: (id: string) => void;
  onIntent: (id: string) => void;
}) {
  return (
    <Table.Tr
      className="clickable-row"
      data-critical={patient.status === 'critical'}
      onClick={() => onOpen(patient.id)}
      onMouseEnter={() => onIntent(patient.id)}
    >
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar name={`${patient.first_name} ${patient.last_name}`} color="initials" size="md" />
          <div style={{ minWidth: 0 }}>
            <Anchor
              component={Link}
              to={`/patients/${patient.id}`}
              fw={600}
              size="sm"
              c="inherit"
              underline="hover"
              style={{ whiteSpace: 'nowrap' }}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => onIntent(patient.id)}
            >
              {displayName(patient)}
            </Anchor>
            <Text size="xs" c="dimmed" truncate maw={260}>
              {patient.email ?? 'No email on file'}
            </Text>
          </div>
        </Group>
      </Table.Td>
      <Table.Td className="numeric">{patient.age}</Table.Td>
      {showMore && (
        <Table.Td>{patient.blood_type === 'unknown' ? '—' : patient.blood_type}</Table.Td>
      )}
      <Table.Td>
        <StatusBadge status={patient.status} />
      </Table.Td>
      <Table.Td>
        <Text size="sm" className="numeric">
          {formatDate(patient.last_visit)}
        </Text>
        <Text size="xs" c="dimmed">
          {formatRelativeDays(patient.last_visit)}
        </Text>
      </Table.Td>
      {showConditions && (
        <Table.Td>
          <Conditions conditions={patient.conditions} />
        </Table.Td>
      )}
    </Table.Tr>
  );
});

const PatientCard = memo(function PatientCard({ patient }: { patient: PatientListItem }) {
  return (
    <Card
      component={Link}
      to={`/patients/${patient.id}`}
      padding="md"
      className="clickable-row link-card"
      data-critical={patient.status === 'critical'}
    >
      <Group gap="sm" wrap="nowrap">
        <Avatar name={`${patient.first_name} ${patient.last_name}`} color="initials" />
        <div style={{ minWidth: 0 }}>
          <Text fw={600} truncate>
            {displayName(patient)}
          </Text>
          <Text size="sm" c="dimmed">
            {patient.age} yrs{patient.blood_type !== 'unknown' && ` · ${patient.blood_type}`}
          </Text>
        </div>
      </Group>
      <Group justify="space-between" mt="sm" wrap="nowrap" gap="xs">
        <Text size="sm" c="dimmed">
          Last visit {formatRelativeDays(patient.last_visit).toLowerCase()}
        </Text>
        <StatusBadge status={patient.status} />
      </Group>
    </Card>
  );
});

interface Props extends SortProps {
  patients: PatientListItem[] | undefined;
  loading: boolean;
  stale: boolean;
  pageSize: number;
  empty: ReactNode;
}

export function PatientTable({ patients, loading, stale, pageSize, empty, ...sort }: Props) {
  // Render one layout only: a table when there is room, cards on phones.
  const isTable = useMediaQuery('(min-width: 48em)', true, { getInitialValueInEffect: false });
  const showMore = useMediaQuery('(min-width: 62em)', true, { getInitialValueInEffect: false });
  const showConditions = useMediaQuery('(min-width: 75em)', true, {
    getInitialValueInEffect: false,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const open = (id: string) => void navigate(`/patients/${id}`);
  const prefetch = (id: string) => void prefetchPatient(queryClient, id);

  if (loading) {
    return (
      <Stack gap={0} aria-busy="true" aria-label="Loading patients" p="md">
        {Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
          <Skeleton key={i} height={52} mb={8} />
        ))}
      </Stack>
    );
  }
  if (!patients?.length) return <Center py={56}>{empty}</Center>;

  return (
    <div style={{ opacity: stale ? 0.6 : 1, transition: 'opacity 150ms' }} aria-busy={stale}>
      {isTable ? (
        <Table.ScrollContainer minWidth={520}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <SortableTh field="name" {...sort}>
                  Patient
                </SortableTh>
                <SortableTh field="age" w={90} {...sort}>
                  Age
                </SortableTh>
                {showMore && (
                  <Table.Th w={110}>
                    <Text fw={600} size="sm" c="dimmed">
                      Blood type
                    </Text>
                  </Table.Th>
                )}
                <SortableTh field="status" w={140} {...sort}>
                  Status
                </SortableTh>
                <SortableTh field="last_visit" w={160} {...sort}>
                  Last visit
                </SortableTh>
                {showConditions && (
                  <Table.Th w={230}>
                    <Text fw={600} size="sm" c="dimmed">
                      Conditions
                    </Text>
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {patients.map((p) => (
                <PatientRow
                  key={p.id}
                  patient={p}
                  showMore={showMore}
                  showConditions={showConditions}
                  onOpen={open}
                  onIntent={prefetch}
                />
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Stack gap="xs" p="sm">
          {patients.map((p) => (
            <PatientCard key={p.id} patient={p} />
          ))}
        </Stack>
      )}
    </div>
  );
}
