import { Alert, Button, Center, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { ApiError, errorMessage } from '@/api/client';
import { Brand } from '@/components/Brand';
import { usePageTitle } from '@/lib/usePageTitle';

import { useLogin, useMe } from './queries';

export default function LoginPage() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useMe();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;
  const destination = from ? `${from.pathname}${from.search}` : '/';

  if (user) return <Navigate to={destination} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      { onSuccess: () => void navigate(destination, { replace: true }) },
    );
  };

  const locked = login.error instanceof ApiError && login.error.status === 429;

  return (
    <div className="login-page">
      <div className="login-brand" aria-hidden>
        <Brand size="lg" />
        <Stack gap="xs" mt="auto">
          <Title order={2} c="white" fz={32} lh={1.2}>
            Patient records, at a glance.
          </Title>
          <Text c="white" opacity={0.85} maw={420}>
            Search, review and update your practice's patients and clinical notes in one secure
            place.
          </Text>
        </Stack>
      </div>

      <Center p="md">
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
          <Stack gap="md">
            <div className="login-mobile-brand">
              <Brand size="lg" />
            </div>
            <div>
              <Title order={1}>Sign in</Title>
              <Text c="dimmed" size="sm" mt={4}>
                Enter your details to view patient records.
              </Text>
            </div>

            {login.error && (
              <Alert
                color={locked ? 'orange' : 'red'}
                icon={<IconAlertCircle />}
                role="alert"
                py="xs"
              >
                {errorMessage(login.error)}
              </Alert>
            )}

            <TextInput
              label="Email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Button type="submit" size="md" loading={login.isPending} fullWidth>
              Sign in
            </Button>
          </Stack>
        </form>
      </Center>
    </div>
  );
}
