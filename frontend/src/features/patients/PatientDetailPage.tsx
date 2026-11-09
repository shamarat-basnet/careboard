import { Center, Grid, Loader, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate, useParams } from 'react-router';

import { ApiError, errorMessage } from '@/api/client';
import { Crumbs } from '@/components/PageHeader';
import { QueryError } from '@/components/QueryError';
import { usePageTitle } from '@/lib/usePageTitle';
import NotFoundPage from '@/pages/NotFoundPage';

import { PatientDetailsCard } from './components/PatientDetailsCard';
import { PatientHeaderCard } from './components/PatientHeaderCard';
import { PatientNotes } from './components/PatientNotes';
import { PatientSummaryCard } from './components/PatientSummaryCard';
import { useDeletePatient, usePatient } from './queries';

export default function PatientDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: patient, error, isPending, refetch } = usePatient(id);
  const deletePatient = useDeletePatient();
  usePageTitle(patient ? `${patient.first_name} ${patient.last_name}` : 'Patient');

  if (isPending) {
    return (
      <Center h={240}>
        <Loader />
      </Center>
    );
  }
  if (error) {
    // 422 means the id in the URL isn't even a valid UUID - treat it as not found too.
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) {
      return <NotFoundPage message="This patient does not exist or has been deleted." />;
    }
    return <QueryError error={error} onRetry={() => void refetch()} />;
  }

  const name = `${patient.first_name} ${patient.last_name}`;
  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete ${name}?`,
      children: (
        <Text size="sm">
          This permanently deletes the patient and all of their clinical notes. This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: 'Delete patient', cancel: 'Cancel' },
      confirmProps: { color: 'red', loading: deletePatient.isPending },
      onConfirm: () =>
        deletePatient.mutate(id, {
          onSuccess: () => {
            notifications.show({
              color: 'teal',
              title: 'Deleted',
              message: `${name} was removed.`,
            });
            void navigate('/patients', { replace: true });
          },
          onError: (err) =>
            notifications.show({
              color: 'red',
              title: 'Delete failed',
              message: errorMessage(err),
            }),
        }),
    });

  return (
    <>
      <Crumbs items={[{ label: 'Patients', to: '/patients' }, { label: name }]} />
      <Stack gap="md">
        <PatientHeaderCard patient={patient} onDelete={confirmDelete} />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="md">
              <PatientSummaryCard patientId={id} />
              <PatientNotes patientId={id} />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <PatientDetailsCard patient={patient} />
          </Grid.Col>
        </Grid>
      </Stack>
    </>
  );
}
