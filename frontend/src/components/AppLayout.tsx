import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Menu,
  NavLink,
  Stack,
  Text,
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
  IconSelector,
  IconSun,
  IconUsers,
} from '@tabler/icons-react';
import { Suspense, type ComponentType } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

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
    <Menu position="top-start" width={232} withArrow>
      <Menu.Target>
        <UnstyledButton
          aria-label="Account menu"
          p={6}
          style={{ borderRadius: 'var(--mantine-radius-md)', minWidth: 0, flex: 1 }}
        >
          <Group gap="sm" wrap="nowrap">
            <Avatar name={user.name} color="initials" size="md" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={600} truncate>
                {user.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {user.email}
              </Text>
            </div>
            <IconSelector size={16} opacity={0.5} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
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

/** The only navigation in the app: a sidebar on desktop, the same content in a drawer on small screens. */
function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const { data: stats } = usePatientStats();
  const critical = stats?.by_status.critical ?? 0;

  return (
    <>
      <AppShell.Section visibleFrom="md" mb="lg" px={6} pt={4}>
        <Link
          to="/"
          aria-label="CareBoard home"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          <Brand />
        </Link>
      </AppShell.Section>

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

      <AppShell.Section>
        <Divider mb="sm" />
        <Group gap={4} wrap="nowrap">
          <AccountMenu />
          <ThemeToggle />
        </Group>
      </AppShell.Section>
    </>
  );
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: { base: 56, md: 0 } }}
      navbar={{ width: 248, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Small screens only: desktop has the sidebar and needs no top bar. */}
      <AppShell.Header hiddenFrom="md">
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Burger
            opened={opened}
            onClick={toggle}
            size="sm"
            aria-label={opened ? 'Close menu' : 'Open menu'}
          />
          <Link to="/" onClick={close} style={{ color: 'inherit', textDecoration: 'none' }}>
            <Brand />
          </Link>
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
