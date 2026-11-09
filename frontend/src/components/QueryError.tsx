import { Alert, Button, Group, Text } from '@mantine/core';
import { IconAlertCircle, IconWifiOff } from '@tabler/icons-react';

import { NetworkError, errorMessage } from '@/api/client';

interface Props {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export function QueryError({ error, onRetry, title = 'Could not load data' }: Props) {
  const offline = error instanceof NetworkError;
  return (
    <Alert
      color={offline ? 'orange' : 'red'}
      icon={offline ? <IconWifiOff /> : <IconAlertCircle />}
      title={offline ? 'Connection problem' : title}
    >
      <Group justify="space-between" gap="sm">
        <Text size="sm">{errorMessage(error)}</Text>
        {onRetry && (
          <Button size="xs" variant="white" color={offline ? 'orange' : 'red'} onClick={onRetry}>
            Retry
          </Button>
        )}
      </Group>
    </Alert>
  );
}
