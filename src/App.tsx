
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
import ProtectedRoute from "./components/auth/ProtectedRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
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
        <StoragePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/files",
    element: (
      <ProtectedRoute>
        <FilesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/providers",
    element: (
      <ProtectedRoute>
        <ProvidersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/api-docs",
    element: (
      <ProtectedRoute>
        <APIDocs />
      </ProtectedRoute>
    ),
  },
  {
    path: "/recents",
    element: (
      <ProtectedRoute>
        <RecentsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/team",
    element: (
      <ProtectedRoute>
        <TeamPage />
      </ProtectedRoute>
    ),
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
