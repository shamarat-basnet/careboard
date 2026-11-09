import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';

import { AppLayout } from '@/components/AppLayout';
import LoginPage from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

// Each page is its own chunk, so the initial bundle only carries the shell.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const PatientListPage = lazy(() => import('@/features/patients/PatientListPage'));
const PatientDetailPage = lazy(() => import('@/features/patients/PatientDetailPage'));
const PatientCreatePage = lazy(() => import('@/features/patients/PatientCreatePage'));
const PatientEditPage = lazy(() => import('@/features/patients/PatientEditPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            path: 'patients',
            children: [
              { index: true, element: <PatientListPage /> },
              { path: 'new', element: <PatientCreatePage /> },
              { path: ':id', element: <PatientDetailPage /> },
              { path: ':id/edit', element: <PatientEditPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
