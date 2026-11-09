import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconWifiOff } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useBlocker } from 'react-router';

import { ApiError, NetworkError, errorMessage } from '@/api/client';
import { BLOOD_TYPES, PATIENT_STATUSES, type PatientInput } from '@/api/types';
import { STATUS_META, todayIso } from '@/lib/format';

import {
  PATIENT_FORM_FIELDS,
  emptyPatientForm,
  patientFormSchema,
  toPatientInput,
  type PatientFormField,
  type PatientFormValues,
} from '../schema';

const COMMON_ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Latex', 'Peanuts', 'Shellfish', 'Aspirin'];
const COMMON_CONDITIONS = [
  'Hypertension',
  'Type 2 diabetes',
  'Asthma',
  'COPD',
  'Hyperlipidemia',
  'Hypothyroidism',
];

interface Props {
  initialValues?: PatientFormValues;
  submitLabel: string;
  onSubmit: (data: PatientInput) => Promise<unknown>;
  onCancel: () => void;
}

export function PatientForm({ initialValues, submitLabel, onSubmit, onCancel }: Props) {
  const [formError, setFormError] = useState<unknown>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: initialValues ?? emptyPatientForm,
    mode: 'onTouched',
  });

  // Warn before throwing away unsaved input (in-app navigation and closing the tab).
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    modals.openConfirmModal({
      title: 'Discard your changes?',
      children: 'You have unsaved changes. If you leave now they will be lost.',
      labels: { confirm: 'Discard changes', cancel: 'Keep editing' },
      confirmProps: { color: 'red' },
      withCloseButton: false,
      closeOnClickOutside: false,
      onConfirm: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
  }, [blocker]);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    leaving.current = true; // a successful save navigates away; that is not "discarding"
    try {
      await onSubmit(toPatientInput(values));
    } catch (err) {
      leaving.current = false;
      // Map server-side validation errors back onto the matching inputs.
      if (err instanceof ApiError && err.status === 422 && err.fields.length) {
        const unmatched = err.fields.filter((f) => {
          const field = f.field.split('.')[0] as PatientFormField;
          if (!PATIENT_FORM_FIELDS.includes(field)) return true;
          setError(field, { type: 'server', message: f.message }, { shouldFocus: true });
          return false;
        });
        if (unmatched.length) setFormError(err);
        return;
      }
      setFormError(err);
    }
  });

  const today = todayIso();

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="xl" maw={960}>
        {formError != null && (
          <Alert
            color={formError instanceof NetworkError ? 'orange' : 'red'}
            icon={formError instanceof NetworkError ? <IconWifiOff /> : <IconAlertCircle />}
            title={formError instanceof NetworkError ? 'Connection problem' : 'Could not save'}
            role="alert"
          >
            {errorMessage(formError)}
            {formError instanceof NetworkError && ' Your changes have not been lost.'}
          </Alert>
        )}

        <FormSection
          title="Personal information"
          description="Name, date of birth and contact details."
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="First name"
              withAsterisk
              autoComplete="off"
              {...register('first_name')}
              error={errors.first_name?.message}
            />
            <TextInput
              label="Last name"
              withAsterisk
              autoComplete="off"
              {...register('last_name')}
              error={errors.last_name?.message}
            />
            <TextInput
              label="Date of birth"
              type="date"
              withAsterisk
              max={today}
              {...register('date_of_birth')}
              error={errors.date_of_birth?.message}
            />
            <TextInput
              label="Last visit"
              type="date"
              max={today}
              {...register('last_visit')}
              error={errors.last_visit?.message}
            />
            <TextInput
              label="Email"
              type="email"
              placeholder="name@example.com"
              {...register('email')}
              error={errors.email?.message}
            />
            <TextInput
              label="Phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              {...register('phone')}
              error={errors.phone?.message}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title="Address" description="Where the patient lives. Optional.">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Address line 1"
              {...register('address_line1')}
              error={errors.address_line1?.message}
            />
            <TextInput
              label="Address line 2"
              {...register('address_line2')}
              error={errors.address_line2?.message}
            />
            <TextInput label="City" {...register('city')} error={errors.city?.message} />
            <SimpleGrid cols={2} spacing="md">
              <TextInput label="State" {...register('state')} error={errors.state?.message} />
              <TextInput
                label="Postal code"
                {...register('postal_code')}
                error={errors.postal_code?.message}
              />
            </SimpleGrid>
          </SimpleGrid>
        </FormSection>

        <FormSection
          title="Medical information"
          description="Status, blood type and the clinical details shown at the top of the patient's page."
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  label="Status"
                  withAsterisk
                  data={PATIENT_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
                  allowDeselect={false}
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  onBlur={field.onBlur}
                  error={errors.status?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="blood_type"
              render={({ field }) => (
                <Select
                  label="Blood type"
                  data={BLOOD_TYPES.map((b) => ({
                    value: b,
                    label: b === 'unknown' ? 'Unknown' : b,
                  }))}
                  allowDeselect={false}
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  onBlur={field.onBlur}
                  error={errors.blood_type?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="allergies"
              render={({ field }) => (
                <TagsInput
                  label="Allergies"
                  description="Type, then press Enter"
                  placeholder="e.g. Penicillin"
                  data={COMMON_ALLERGIES}
                  clearable
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.allergies?.message ?? errors.allergies?.[0]?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="conditions"
              render={({ field }) => (
                <TagsInput
                  label="Conditions"
                  description="Type, then press Enter"
                  placeholder="e.g. Hypertension"
                  data={COMMON_CONDITIONS}
                  clearable
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.conditions?.message ?? errors.conditions?.[0]?.message}
                />
              )}
            />
          </SimpleGrid>
        </FormSection>
      </Stack>

      {/* Stays on screen so Save is always reachable, however long the form is. */}
      <Paper className="sticky-actions" p="sm">
        <Group justify="space-between" maw={960} wrap="nowrap">
          <Text size="sm" c={isDirty ? 'orange' : 'dimmed'} role="status">
            {isDirty ? 'You have unsaved changes' : 'No changes yet'}
          </Text>
          <Group gap="sm" wrap="nowrap">
            <Button variant="default" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={initialValues && !isDirty}>
              {submitLabel}
            </Button>
          </Group>
        </Group>
      </Paper>
    </form>
  );
}

/** Label and help text on the left, the fields in a card on the right (stacked on phones). */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Title order={3}>{title}</Title>
        <Text size="sm" c="dimmed" mt={4}>
          {description}
        </Text>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Card>{children}</Card>
      </Grid.Col>
    </Grid>
  );
}
