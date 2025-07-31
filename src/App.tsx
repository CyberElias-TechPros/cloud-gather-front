
import React, { useEffect } from 'react';
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useMonitoring } from '@/hooks/useMonitoring';
import ErrorPage from "./pages/ErrorPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StoragePage from "./pages/StoragePage";
import FilesPage from "./pages/FilesPage";
import SettingsPage from "./pages/SettingsPage";
import ProvidersPage from "./pages/ProvidersPage";
import RegisterPage from "./pages/RegisterPage";
import APIDocs from "./pages/APIDocs";
import RecentsPage from "./pages/RecentsPage";
import TeamPage from "./pages/TeamPage";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import AdminPage from "./pages/AdminPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <DashboardPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/storage",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <StoragePage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/files",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <FilesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <SettingsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/providers",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <ProvidersPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/api-docs",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <APIDocs />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/recents",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <RecentsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/team",
    element: (
      <ProtectedRoute>
        <ErrorBoundary>
          <TeamPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <ErrorBoundary>
          <AdminPage />
        </ErrorBoundary>
      </AdminRoute>
    ),
  },
]);

function App() {
  const { recordActivity } = useMonitoring();

  useEffect(() => {
    // Record app initialization
    recordActivity('app_init', 'application');

    // Global error handler for unhandled errors
    const handleError = (event: ErrorEvent) => {
      recordActivity('unhandled_error', 'error', event.filename, false, { message: event.message });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      recordActivity('unhandled_promise_rejection', 'error', undefined, false, { reason: event.reason?.toString() });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [recordActivity]);

  return <RouterProvider router={router} />;
}

export default App;
