import { zodResolver } from '@hookform/resolvers/zod';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconNotes, IconTrash } from '@tabler/icons-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiError, errorMessage } from '@/api/client';
import { QueryError } from '@/components/QueryError';
import { formatDateTime, toDateTimeLocal } from '@/lib/format';

import { useAddNote, useDeleteNote, useNotes } from '../queries';

const MAX_LENGTH = 5000;

const noteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Note cannot be empty')
    .max(MAX_LENGTH, `Note must be at most ${MAX_LENGTH} characters`),
  timestamp: z
    .string()
    .min(1, 'Choose when this was observed')
    .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60_000, 'Cannot be in the future'),
});
type NoteFormValues = z.infer<typeof noteSchema>;

function NoteForm({ patientId }: { patientId: string }) {
  const addNote = useAddNote(patientId);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { content: '', timestamp: toDateTimeLocal(new Date()) },
  });
  const length = watch('content').length;

  const submit = handleSubmit(async (values) => {
    try {
      await addNote.mutateAsync({
        content: values.content,
        // datetime-local has no zone; convert from the user's local time to an absolute instant.
        timestamp: new Date(values.timestamp).toISOString(),
      });
      reset({ content: '', timestamp: toDateTimeLocal(new Date()) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        for (const f of err.fields) {
          if (f.field === 'content' || f.field === 'timestamp') {
            setError(f.field, { type: 'server', message: f.message });
          }
        }
        if (err.fields.length) return;
      }
      setError('root', { message: errorMessage(err) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="sm">
        {errors.root && (
          <Alert color="red" icon={<IconAlertCircle />} py="xs">
            {errors.root.message}
          </Alert>
        )}
        <Textarea
          label="New note"
          placeholder="Observations, assessment, plan…"
          autosize
          minRows={3}
          maxRows={10}
          {...register('content')}
          error={errors.content?.message}
          description={`${length}/${MAX_LENGTH}`}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
        />
        <Group align="flex-end" justify="space-between" gap="sm">
          <TextInput
            label="Observed at"
            type="datetime-local"
            {...register('timestamp')}
            error={errors.timestamp?.message}
            w={{ base: '100%', xs: 240 }}
          />
          <Button type="submit" loading={isSubmitting}>
            Add note
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function PatientNotes({ patientId }: { patientId: string }) {
  const { data: notes, error, isPending, refetch } = useNotes(patientId);
  const deleteNote = useDeleteNote(patientId);

  const confirmDelete = (noteId: string) =>
    modals.openConfirmModal({
      title: 'Delete note?',
      children: <Text size="sm">This permanently removes the note from the patient record.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        deleteNote.mutate(noteId, {
          onError: (err) =>
            notifications.show({
              color: 'red',
              title: 'Could not delete note',
              message: errorMessage(err),
            }),
        }),
    });

  return (
    <Card>
      <Group justify="space-between" mb="md">
        <Title order={4}>Clinical notes</Title>
        {notes && (
          <Text size="sm" c="dimmed">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </Text>
        )}
      </Group>

      <NoteForm patientId={patientId} />

      <Stack mt="xl">
        {isPending && <Skeleton h={80} />}
        {error && <QueryError error={error} onRetry={() => void refetch()} />}
        {notes?.length === 0 && (
          <Text c="dimmed" size="sm" ta="center" py="md">
            No notes yet.
          </Text>
        )}
        {notes && notes.length > 0 && (
          <Timeline bulletSize={22} lineWidth={2}>
            {notes.map((note) => (
              <Timeline.Item
                key={note.id}
                bullet={<IconNotes size={12} />}
                title={
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Text size="sm" fw={600} component="time" dateTime={note.timestamp}>
                      {formatDateTime(note.timestamp)}
                    </Text>
                    <Tooltip label="Delete note">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Delete note"
                        onClick={() => confirmDelete(note.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                }
              >
                <Text size="sm" className="note-content">
                  {note.content}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Stack>
    </Card>
  );
}
