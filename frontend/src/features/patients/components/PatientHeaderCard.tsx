import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconDots, IconEdit, IconTrash } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { Patient } from '@/api/types';
import { formatDate, formatRelativeDays } from '@/lib/format';

import { StatusBadge } from './StatusBadge';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.4}>
        {label}
      </Text>
      <Text size="sm" fw={500} component="div">
        {children}
      </Text>
    </div>
  );
}

function Tags({ items, color, empty }: { items: string[]; color: string; empty: string }) {
  if (!items.length)
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    );
  return (
    <Group gap={6}>
      {items.map((item) => (
        <Badge key={item} color={color} variant="light" tt="none" fw={500} size="lg">
          {item}
        </Badge>
      ))}
    </Group>
  );
}

/** The at-a-glance snapshot a clinician needs first: who, how old, status, allergies, conditions. */
export function PatientHeaderCard({
  patient,
  onDelete,
}: {
  patient: Patient;
  onDelete: () => void;
}) {
  const name = `${patient.first_name} ${patient.last_name}`;
  return (
    <Card>
      <Group justify="space-between" align="flex-start" gap="md">
        <Group gap="md" wrap="nowrap" align="flex-start">
          <Avatar name={name} color="initials" size={64} radius="xl" />
          <Stack gap={8}>
            <Group gap="sm">
              <Title order={1}>{name}</Title>
              <StatusBadge status={patient.status} size="lg" />
            </Group>
            <Group gap={32} wrap="wrap">
              <Fact label="Age">{patient.age} years</Fact>
              <Fact label="Blood type">
                {patient.blood_type === 'unknown' ? 'Unknown' : patient.blood_type}
              </Fact>
              <Fact label="Last visit">
                {formatDate(patient.last_visit)}
                {patient.last_visit && (
                  <Text span size="xs" c="dimmed">
                    {' '}
                    · {formatRelativeDays(patient.last_visit)}
                  </Text>
                )}
              </Fact>
            </Group>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Button
            component={Link}
            to={`/patients/${patient.id}/edit`}
            variant="default"
            leftSection={<IconEdit size={16} />}
          >
            Edit
          </Button>
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon variant="default" aria-label="More actions">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
                Delete patient
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Divider my="md" />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Fact label="Allergies">
          <Tags items={patient.allergies} color="red" empty="No known allergies" />
        </Fact>
        <Fact label="Conditions">
          <Tags items={patient.conditions} color="grape" empty="None documented" />
        </Fact>
      </SimpleGrid>
    </Card>
  );
}
