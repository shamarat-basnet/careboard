import {
  Anchor,
  Avatar,
  Button,
  Card,
  Grid,
  Group,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendarCheck,
  IconPlus,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';

import { PATIENT_STATUSES, type PatientListParams } from '@/api/types';
import { PageHeader } from '@/components/PageHeader';
import { QueryError } from '@/components/QueryError';
import { useMe } from '@/features/auth/queries';
import { StatusBadge } from '@/features/patients/components/StatusBadge';
import { usePatientStats, usePatients } from '@/features/patients/queries';
import { STATUS_META, formatRelativeDays } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const today = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });

function Kpi({
  label,
  value,
  hint,
  to,
  icon: Icon,
  color,
}: {
  label: string;
  value?: number;
  hint: string;
  to: string;
  icon: ComponentType<{ size?: number }>;
  color: string;
}) {
  return (
    <Card component={Link} to={to} className="link-card" aria-label={`${label}: view patients`}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          {value === undefined ? (
            <Skeleton h={36} w={72} />
          ) : (
            <Text fz={32} fw={700} lh={1.1} className="numeric">
              {value.toLocaleString()}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        </Stack>
        <ThemeIcon size={40} radius="md" variant="light" color={color}>
          <Icon size={22} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function StatusBreakdown() {
  const { data: stats, error } = usePatientStats();
  return (
    <Card h="100%">
      <Title order={3} mb="md">
        Patients by status
      </Title>
      {error && <QueryError error={error} />}
      {!stats && !error && <Skeleton h={120} />}
      {stats && (
        <Stack gap="md">
          <Progress.Root size={14} aria-hidden>
            {PATIENT_STATUSES.map((s) => (
              <Progress.Section
                key={s}
                value={stats.total ? (stats.by_status[s] / stats.total) * 100 : 0}
                color={STATUS_META[s].color}
              />
            ))}
          </Progress.Root>
          <Stack gap={6}>
            {PATIENT_STATUSES.map((s) => {
              const count = stats.by_status[s];
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
              return (
                <Anchor
                  key={s}
                  component={Link}
                  to={`/patients?status=${s}`}
                  c="inherit"
                  underline="never"
                  className="link-row"
                >
                  <Group justify="space-between" py={4}>
                    <StatusBadge status={s} />
                    <Text size="sm" className="numeric">
                      <Text span fw={600}>
                        {count}
                      </Text>
                      <Text span c="dimmed">
                        {' '}
                        · {pct}%
                      </Text>
                    </Text>
                  </Group>
                </Anchor>
              );
            })}
          </Stack>
        </Stack>
      )}
    </Card>
  );
}

function PatientMiniList({
  title,
  subtitle,
  params,
  viewAllTo,
  empty,
}: {
  title: string;
  subtitle: string;
  params: PatientListParams;
  viewAllTo: string;
  empty: string;
}) {
  const { data, error, isPending } = usePatients(params);
  return (
    <Card h="100%">
      <Group justify="space-between" align="flex-start" mb="sm">
        <div>
          <Title order={3}>{title}</Title>
          <Text size="xs" c="dimmed">
            {subtitle}
          </Text>
        </div>
        <Anchor component={Link} to={viewAllTo} size="sm">
          View all
        </Anchor>
      </Group>
      {isPending && <Skeleton h={220} />}
      {error && <QueryError error={error} />}
      {data?.items.length === 0 && (
        <Text size="sm" c="dimmed" py="md">
          {empty}
        </Text>
      )}
      <Stack gap={0}>
        {data?.items.map((p) => (
          <UnstyledButton
            key={p.id}
            component={Link}
            to={`/patients/${p.id}`}
            className="link-row"
            display="block"
            px="xs"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <Group justify="space-between" wrap="nowrap" py={10}>
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Avatar name={`${p.first_name} ${p.last_name}`} color="initials" size="md" />
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>
                    {p.last_name}, {p.first_name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {p.age} yrs · seen {formatRelativeDays(p.last_visit).toLowerCase()}
                  </Text>
                </div>
              </Group>
              <StatusBadge status={p.status} />
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Card>
  );
}

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { data: stats, error } = usePatientStats();
  const { data: user } = useMe();

  return (
    <>
      <PageHeader
        title={`${greeting()}${user ? `, ${user.name}` : ''}`}
        description={today.format(new Date())}
        actions={
          <Button component={Link} to="/patients/new" leftSection={<IconPlus size={16} />}>
            New patient
          </Button>
        }
      />
      {error && <QueryError error={error} />}

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md" mb="md">
        <Kpi
          label="Total patients"
          value={stats?.total}
          hint="All records"
          to="/patients"
          icon={IconUsers}
          color="gray"
        />
        <Kpi
          label="Active"
          value={stats?.by_status.active}
          hint="In ongoing care"
          to="/patients?status=active"
          icon={IconUserCheck}
          color="green"
        />
        <Kpi
          label="Critical"
          value={stats?.by_status.critical}
          hint="Need close follow-up"
          to="/patients?status=critical"
          icon={IconAlertTriangle}
          color="red"
        />
        <Kpi
          label="Seen in last 30 days"
          value={stats?.seen_last_30_days}
          hint="Recent visits"
          to="/patients?sort=last_visit&order=desc"
          icon={IconCalendarCheck}
          color="blue"
        />
      </SimpleGrid>

      <Grid gutter="md" mb="md">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <StatusBreakdown />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <PatientMiniList
            title="Critical patients"
            subtitle="Longest since their last visit first"
            params={{
              page: 1,
              page_size: 5,
              status: ['critical'],
              sort_by: 'last_visit',
              sort_order: 'asc',
            }}
            viewAllTo="/patients?status=critical&sort=last_visit"
            empty="No critical patients."
          />
        </Grid.Col>
      </Grid>

      <PatientMiniList
        title="Recently seen"
        subtitle="Latest visits across the practice"
        params={{ page: 1, page_size: 5, sort_by: 'last_visit', sort_order: 'desc' }}
        viewAllTo="/patients?sort=last_visit&order=desc"
        empty="No visits recorded."
      />
    </>
  );
}
