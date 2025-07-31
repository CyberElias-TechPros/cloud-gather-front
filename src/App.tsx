
import React from 'react';
import { RouterProvider, createBrowserRouter } from "react-router-dom";
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
import { MonitoringProvider } from '@/components/common/MonitoringProvider';

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <MonitoringProvider>
        <LandingPage />
      </MonitoringProvider>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/dashboard",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <DashboardPage />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/login",
    element: (
      <MonitoringProvider>
        <LoginPage />
      </MonitoringProvider>
    ),
  },
  {
    path: "/auth",
    element: (
      <MonitoringProvider>
        <AuthPage />
      </MonitoringProvider>
    ),
  },
  {
    path: "/register",
    element: (
      <MonitoringProvider>
        <RegisterPage />
      </MonitoringProvider>
    ),
  },
  {
    path: "/storage",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <StoragePage />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/files",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <FilesPage />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/settings",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <SettingsPage />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/providers",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <ProvidersPage />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/api-docs",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <APIDocs />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/recents",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <RecentsPage />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/team",
    element: (
      <MonitoringProvider>
        <ProtectedRoute>
          <ErrorBoundary>
            <TeamPage />
          </ErrorBoundary>
        </ProtectedRoute>
      </MonitoringProvider>
    ),
  },
  {
    path: "/admin",
    element: (
      <MonitoringProvider>
        <AdminRoute>
          <ErrorBoundary>
            <AdminPage />
          </ErrorBoundary>
        </AdminRoute>
      </MonitoringProvider>
    ),
  },
]);

function App() {
  return (
    <RouterProvider 
      router={router} 
      fallbackElement={
        <MonitoringProvider>
          <div>Loading...</div>
        </MonitoringProvider>
      }
    />
  );
}

export default App;
