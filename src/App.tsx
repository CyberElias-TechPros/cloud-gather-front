import React, { Suspense, lazy, useEffect } from "react";
import { RouterProvider, createBrowserRouter, Outlet, Navigate, useLocation } from "react-router-dom";
import ErrorPage from "./pages/ErrorPage";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { LogoMark } from "@/components/brand/Logo";
import { siteConfig } from "@/lib/site";

/* Code-split app + marketing routes: the initial bundle carries only the shell
   and the landing page; everything else loads on demand. */
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const DevelopersPage = lazy(() => import("./pages/DevelopersPage"));

const StoragePage = lazy(() => import("./pages/StoragePage"));
const FilesPage = lazy(() => import("./pages/FilesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProvidersPage = lazy(() => import("./pages/ProvidersPage"));
const ApiKeysPage = lazy(() => import("./pages/ApiKeysPage"));
const RecentsPage = lazy(() => import("./pages/RecentsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

/** Scroll to top on navigation (respects back/forward popstate). */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
};

const RouteLoading: React.FC = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
    <LogoMark className="h-9 w-9 animate-pulse" />
    <span className="sr-only">Loading…</span>
  </div>
);

const marketingChildren = (
  <MarketingSuspenseWrapper />
);

function MarketingSuspenseWrapper() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Outlet />
    </Suspense>
  );
}

const AppLayoutBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <AppLayout>{children}</AppLayout>
  </ErrorBoundary>
);

const router = createBrowserRouter([
  { path: "/", element: <LandingPage />, errorElement: <ErrorPage /> },

  // Auth
  { path: "/login", element: <AuthPage mode="login" />, errorElement: <ErrorPage /> },
  { path: "/register", element: <AuthPage mode="register" />, errorElement: <ErrorPage /> },
  { path: "/auth", element: <Navigate to="/login" replace /> },
  { path: "/reset-password", element: <ResetPasswordPage />, errorElement: <ErrorPage /> },

  // Public marketing (shared suspense boundary)
  {
    element: marketingChildren,
    errorElement: <ErrorPage />,
    children: [
      { path: "/features", element: <FeaturesPage /> },
      { path: "/pricing", element: <PricingPage /> },
      { path: "/blog", element: <BlogPage /> },
      { path: "/blog/:slug", element: <BlogPostPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/contact", element: <ContactPage /> },
      { path: "/privacy", element: <PrivacyPage /> },
      { path: "/terms", element: <TermsPage /> },
      { path: "/developers", element: <DevelopersPage /> },
    ],
  },

  // Authenticated app
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <DashboardPage />
          </Suspense>
        </AppLayoutBoundary>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/files",
    element: (
      <ProtectedRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <FilesPage />
          </Suspense>
        </AppLayoutBoundary>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/storage",
    element: (
      <ProtectedRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <StoragePage />
          </Suspense>
        </AppLayoutBoundary>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/providers",
    element: (
      <ProtectedRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <ProvidersPage />
          </Suspense>
        </AppLayoutBoundary>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/recents",
    element: (
      <ProtectedRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <RecentsPage />
          </Suspense>
        </AppLayoutBoundary>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/api-keys",
    element: (
      <ProtectedRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <ApiKeysPage />
          </Suspense>
        </AppLayoutBoundary>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <SettingsPage />
          </Suspense>
        </AppLayoutBoundary>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <AppLayoutBoundary>
          <Suspense fallback={<RouteLoading />}>
            <AdminPage />
          </Suspense>
        </AppLayoutBoundary>
      </AdminRoute>
    ),
    errorElement: <ErrorPage />,
  },

  // 404 catch-all
  { path: "*", element: <NotFound />, errorElement: <ErrorPage /> },
]);

function App() {
  return (
    <RouterProvider
      router={router}
      fallbackElement={
        <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
          <LogoMark className="h-10 w-10 animate-pulse" />
          <span className="sr-only">Loading {siteConfig.name}…</span>
        </div>
      }
    />
  );
}

export default App;
