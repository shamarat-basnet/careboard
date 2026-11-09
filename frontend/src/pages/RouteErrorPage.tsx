import { Button, Stack, Text, Title } from '@mantine/core';
import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Last-resort error screen for errors thrown outside a page (e.g. in the layout). */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <Stack align="center" py={80} ta="center">
      <Title order={2}>Something went wrong</Title>
      <Text c="dimmed">{message}</Text>
      <Button onClick={() => window.location.assign('/')}>Reload app</Button>
    </Stack>
  );
}
