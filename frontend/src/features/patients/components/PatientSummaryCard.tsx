import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconRefresh, IconSparkles } from '@tabler/icons-react';

import { QueryError } from '@/components/QueryError';
import { formatDateTime } from '@/lib/format';

import { usePatientSummary } from '../queries';

export function PatientSummaryCard({ patientId }: { patientId: string }) {
  const { data, error, isPending, isFetching, refetch } = usePatientSummary(patientId);

  return (
    <Card>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs">
          <IconSparkles size={18} />
          <Title order={4}>Summary</Title>
          {data && (
            <Badge variant="light" color={data.source === 'llm' ? 'violet' : 'gray'} size="sm">
              {data.source === 'llm' ? 'AI generated' : 'Template'}
            </Badge>
          )}
        </Group>
        <Tooltip label="Regenerate summary">
          <ActionIcon
            variant="subtle"
            aria-label="Regenerate summary"
            loading={isFetching}
            onClick={() => void refetch()}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {isPending && (
        <Stack gap={6}>
          <Skeleton h={12} />
          <Skeleton h={12} />
          <Skeleton h={12} w="70%" />
        </Stack>
      )}
      {error && <QueryError error={error} onRetry={() => void refetch()} title="Summary failed" />}
      {data && (
        <Stack gap="xs">
          <Text size="sm" lh={1.6} className="note-content">
            {data.narrative}
          </Text>
          <Text size="xs" c="dimmed">
            Based on {data.note_count} {data.note_count === 1 ? 'note' : 'notes'} · generated{' '}
            {formatDateTime(data.generated_at)}
          </Text>
        </Stack>
      )}
    </Card>
  );
}
