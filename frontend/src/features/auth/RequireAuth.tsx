import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router';

import { QueryError } from '@/components/QueryError';

import { useMe } from './queries';

/** Everything inside renders only for a signed-in user; others are sent to /login. */
export function RequireAuth() {
  const { data: user, isPending, error, refetch } = useMe();
  const location = useLocation();

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (error) {
    return (
      <Center h="100vh" p="md">
        <QueryError error={error} onRetry={() => void refetch()} title="Can't reach the server" />
      </Center>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
