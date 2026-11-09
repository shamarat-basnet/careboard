import { Group, Text, ThemeIcon } from '@mantine/core';
import { IconHeartbeat } from '@tabler/icons-react';

export function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <Group gap={10} wrap="nowrap">
      <ThemeIcon size={big ? 44 : 34} radius="md">
        <IconHeartbeat size={big ? 26 : 20} />
      </ThemeIcon>
      <Text fw={700} fz={big ? 'xl' : 'lg'} lh={1}>
        CareBoard
      </Text>
    </Group>
  );
}
