import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  NavLink,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSun,
  IconUsers,
} from '@tabler/icons-react';
import { Suspense, useState, type ComponentType, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';

import { useLogout, useMe } from '@/features/auth/queries';
import { usePatientStats } from '@/features/patients/queries';

import { Brand } from './Brand';
import { ErrorBoundary } from './ErrorBoundary';

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip label={`Switch to ${next} theme`}>
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={`Switch to ${next} theme`}
        onClick={() => setColorScheme(next)}
      >
        {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

function AccountMenu() {
  const { data: user } = useMe();
  const logout = useLogout();
  if (!user) return null;
  return (
    <Menu position="bottom-end" width={240} withArrow>
      <Menu.Target>
        <UnstyledButton aria-label="Account menu" style={{ borderRadius: '50%' }}>
          <Avatar name={user.name} color="initials" size="md" />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={600} c="var(--mantine-color-text)" truncate>
            {user.name}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {user.email}
          </Text>
        </Menu.Label>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} />}
          onClick={() => logout.mutate()}
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Jumps to the patient list with the query applied; the list page owns the actual search. */
function HeaderSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/patients?q=${encodeURIComponent(q)}` : '/patients');
  };
  return (
    <form onSubmit={submit} role="search" style={{ flex: 1, maxWidth: 420 }}>
      <TextInput
        aria-label="Search patients"
        placeholder="Search patients"
        leftSection={<IconSearch size={16} />}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
    </form>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: IconUsers },
];

/** The only navigation links in the app: a sidebar on desktop, the same list in a drawer on small screens. */
function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const { data: stats } = usePatientStats();
  const critical = stats?.by_status.critical ?? 0;

  return (
    <>
      <AppShell.Section grow>
        <Stack gap={4}>
          {NAV.map((item) => {
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                component={Link}
                to={item.to}
                label={item.label}
                leftSection={<item.icon size={18} />}
                active={active}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
                rightSection={
                  item.to === '/patients' && critical > 0 ? (
                    <Tooltip label={`${critical} critical`}>
                      <Badge
                        color="red"
                        size="sm"
                        circle={critical < 10}
                        aria-label={`${critical} critical patients`}
                      >
                        {critical}
                      </Badge>
                    </Tooltip>
                  ) : undefined
                }
              />
            );
          })}
        </Stack>
      </AppShell.Section>
    </>
  );
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 248, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="md"
            size="sm"
            aria-label={opened ? 'Close menu' : 'Open menu'}
          />
          <Link
            to="/"
            onClick={close}
            aria-label="CareBoard home"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <Brand />
          </Link>
          <Group gap="sm" wrap="nowrap" style={{ flex: 1 }} justify="flex-end">
            <Group visibleFrom="sm" style={{ flex: 1 }} justify="center">
              <HeaderSearch />
            </Group>
            <ThemeToggle />
            <AccountMenu />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" aria-label="Main">
        <Sidebar onNavigate={close} />
      </AppShell.Navbar>

      <AppShell.Main id="main" className="app-main">
        <Container size={1200} p={{ base: 'md', sm: 'xl' }}>
          <ErrorBoundary resetKey={pathname}>
            <Suspense
              fallback={
                <Center h={240}>
                  <Loader />
                </Center>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
