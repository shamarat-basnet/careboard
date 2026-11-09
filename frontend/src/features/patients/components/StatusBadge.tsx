import { Badge, Box, type BadgeProps } from '@mantine/core';

import type { PatientStatus } from '@/api/types';
import { STATUS_META } from '@/lib/format';

/** A coloured dot plus the word: status never relies on colour alone. */
export function StatusBadge({ status, ...props }: { status: PatientStatus } & BadgeProps) {
  const meta = STATUS_META[status];
  return (
    <Badge
      color={meta.color}
      variant="light"
      tt="none"
      fw={600}
      style={{ flexShrink: 0 }}
      leftSection={
        <Box
          w={6}
          h={6}
          style={{ borderRadius: '50%', background: `var(--mantine-color-${meta.color}-filled)` }}
        />
      }
      {...props}
    >
      {meta.label}
    </Badge>
  );
}
