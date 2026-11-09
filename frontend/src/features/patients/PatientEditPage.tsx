import { Center, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import type { Patient } from '@/api/types';
import { usePageTitle } from '@/lib/usePageTitle';
import { PageHeader } from '@/components/PageHeader';
import { QueryError } from '@/components/QueryError';
import NotFoundPage from '@/pages/NotFoundPage';

import { PatientForm } from './components/PatientForm';
import { usePatient, useUpdatePatient } from './queries';
import { fromPatient } from './schema';

function EditForm({ loaded }: { loaded: Patient }) {
  const navigate = useNavigate();
  const update = useUpdatePatient(loaded.id);
  // Freeze what the user started from. Background refetches must neither reset the form nor
  // swap the version we send: if someone else saved meanwhile, the server answers 409.
  const [patient] = useState(loaded);
  const name = `${patient.first_name} ${patient.last_name}`;
  usePageTitle(`Edit ${name}`);

  return (
    <>
      <PageHeader
        title={`Edit ${name}`}
        breadcrumbs={[
          { label: 'Patients', to: '/patients' },
          { label: name, to: `/patients/${patient.id}` },
          { label: 'Edit' },
        ]}
      />
      <PatientForm
        initialValues={fromPatient(patient)}
        submitLabel="Save changes"
        onCancel={() => void navigate(`/patients/${patient.id}`)}
        onSubmit={async (data) => {
          await update.mutateAsync({ ...data, updated_at: patient.updated_at });
          notifications.show({ color: 'teal', title: 'Saved', message: `${name} was updated.` });
          void navigate(`/patients/${patient.id}`);
        }}
      />
    </>
  );
}

export default function PatientEditPage() {
  const { id = '' } = useParams();
  const { data: patient, error, isPending, refetch } = usePatient(id);

  if (isPending) {
    return (
      <Center h={240}>
        <Loader />
      </Center>
    );
  }
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) {
      return <NotFoundPage message="This patient does not exist or has been deleted." />;
    }
    return <QueryError error={error} onRetry={() => void refetch()} />;
  }
  return <EditForm loaded={patient} />;
}
