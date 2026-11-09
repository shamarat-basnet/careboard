import { Anchor, Breadcrumbs, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface Crumb {
  label: string;
  to?: string;
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumbs separatorMargin={6} aria-label="Breadcrumb" mb="xs">
      {items.map((b) =>
        b.to ? (
          <Anchor key={b.label} component={Link} to={b.to} size="sm" c="dimmed">
            {b.label}
          </Anchor>
        ) : (
          <Text key={b.label} size="sm" aria-current="page">
            {b.label}
          </Text>
        ),
      )}
    </Breadcrumbs>
  );
}

/** Every page starts with this: one h1, an optional one-line description, and the page's actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div style={{ marginBottom: 'var(--mantine-spacing-lg)' }}>
      {breadcrumbs && <Crumbs items={breadcrumbs} />}
      <Group justify="space-between" align="flex-end" gap="md">
        <Stack gap={2}>
          <Title order={1}>{title}</Title>
          {description && (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          )}
        </Stack>
        {actions && <Group gap="sm">{actions}</Group>}
      </Group>
    </div>
  );
}
