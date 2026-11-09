import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/lib/usePageTitle';
import { PageHeader } from '@/components/PageHeader';

import { PatientForm } from './components/PatientForm';
import { useCreatePatient } from './queries';

export default function PatientCreatePage() {
  usePageTitle('New patient');
  const navigate = useNavigate();
  const create = useCreatePatient();

  return (
    <>
      <PageHeader
        title="New patient"
        breadcrumbs={[{ label: 'Patients', to: '/patients' }, { label: 'New' }]}
      />
      <PatientForm
        submitLabel="Create patient"
        onCancel={() => void navigate(-1)}
        onSubmit={async (data) => {
          const patient = await create.mutateAsync(data);
          notifications.show({
            color: 'teal',
            title: 'Patient created',
            message: `${patient.first_name} ${patient.last_name} was added.`,
          });
          void navigate(`/patients/${patient.id}`, { replace: true });
        }}
      />
    </>
  );
}
