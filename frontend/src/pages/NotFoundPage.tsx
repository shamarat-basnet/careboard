import { Button, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';

import { usePageTitle } from '@/lib/usePageTitle';

export default function NotFoundPage({ message }: { message?: string }) {
  usePageTitle('Page not found');
  return (
    <Stack align="center" gap="md" py={80} ta="center">
      <Title order={1} size={64} c="dimmed">
        404
      </Title>
      <Title order={2}>Page not found</Title>
      <Text c="dimmed" maw={420}>
        {message ?? "The page you're looking for doesn't exist or may have been moved."}
      </Text>
      <Button component={Link} to="/">
        Back to dashboard
      </Button>
    </Stack>
  );
}
