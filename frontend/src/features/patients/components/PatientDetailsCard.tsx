import { Anchor, Card, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

import type { Patient } from '@/api/types';
import { formatDate } from '@/lib/format';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.4}>
        {label}
      </Text>
      <Text size="sm" component="div">
        {children || '—'}
      </Text>
    </div>
  );
}

/** Contact and administrative details: needed less often than the clinical content beside it. */
export function PatientDetailsCard({ patient }: { patient: Patient }) {
  const cityLine = [patient.city, patient.state, patient.postal_code].filter(Boolean).join(', ');
  const address = [patient.address_line1, patient.address_line2, cityLine].filter(Boolean);
  return (
    <Card>
      <Title order={3} mb="md">
        Details
      </Title>
      <Stack gap="md">
        <Row label="Date of birth">{formatDate(patient.date_of_birth)}</Row>
        <Row label="Phone">
          {patient.phone && (
            <Anchor href={`tel:${patient.phone}`} size="sm">
              {patient.phone}
            </Anchor>
          )}
        </Row>
        <Row label="Email">
          {patient.email && (
            <Anchor href={`mailto:${patient.email}`} size="sm" style={{ overflowWrap: 'anywhere' }}>
              {patient.email}
            </Anchor>
          )}
        </Row>
        <Row label="Address">
          {address.length > 0 && address.map((line) => <div key={line}>{line}</div>)}
        </Row>
        <Text size="xs" c="dimmed">
          Record updated {formatDate(patient.updated_at.slice(0, 10))}
        </Text>
      </Stack>
    </Card>
  );
}
