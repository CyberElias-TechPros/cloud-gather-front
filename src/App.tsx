
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

const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/storage",
    element: <StoragePage />,
  },
  {
    path: "/files",
    element: <FilesPage />,
  },
  {
    path: "/settings",
    element: <SettingsPage />,
  },
  {
    path: "/providers",
    element: <ProvidersPage />,
  },
  {
    path: "/api-docs",
    element: <APIDocs />,
  },
  {
    path: "/recents",
    element: <RecentsPage />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
