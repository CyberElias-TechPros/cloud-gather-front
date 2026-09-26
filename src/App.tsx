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
const StatusPage = lazy(() => import("./pages/StatusPage"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));

const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const PublicLinkPage = lazy(() => import("./pages/PublicLinkPage"));

const StoragePage = lazy(() => import("./pages/StoragePage"));
const FilesPage = lazy(() => import("./pages/FilesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProvidersPage = lazy(() => import("./pages/ProvidersPage"));
const ApiKeysPage = lazy(() => import("./pages/ApiKeysPage"));
const WebhooksPage = lazy(() => import("./pages/WebhooksPage"));
const RecentsPage = lazy(() => import("./pages/RecentsPage"));
const SharedPage = lazy(() => import("./pages/SharedPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
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

function SuspenseOutlet() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
    </>
  );
}

const AppLayoutBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <AppLayout>{children}</AppLayout>
  </ErrorBoundary>
);

/** Wraps a page in auth + app chrome + a lazy boundary. */
const protectedRoute = (path: string, element: React.ReactNode, admin = false) => {
  const inner = (
    <AppLayoutBoundary>
      <Suspense fallback={<RouteLoading />}>{element}</Suspense>
    </AppLayoutBoundary>
  );
  return {
    path,
    element: admin ? <AdminRoute>{inner}</AdminRoute> : <ProtectedRoute>{inner}</ProtectedRoute>,
    errorElement: <ErrorPage />,
  };
};

const router = createBrowserRouter([
  { path: "/", element: <LandingPage />, errorElement: <ErrorPage /> },

  // Auth
  { path: "/login", element: <AuthPage mode="login" />, errorElement: <ErrorPage /> },
  { path: "/register", element: <AuthPage mode="register" />, errorElement: <ErrorPage /> },
  { path: "/auth", element: <Navigate to="/login" replace /> },
  { path: "/signup", element: <Navigate to="/register" replace /> },
  { path: "/reset-password", element: <ResetPasswordPage />, errorElement: <ErrorPage /> },

  // Public pages that load lazily (marketing + link/callback surfaces)
  {
    element: <SuspenseOutlet />,
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
      { path: "/status", element: <StatusPage /> },
      { path: "/unsubscribe", element: <UnsubscribePage /> },
      { path: "/auth/callback", element: <AuthCallbackPage /> },
      { path: "/verify-email", element: <VerifyEmailPage /> },
      { path: "/l/:token", element: <PublicLinkPage /> },
      { path: "/s/:token", element: <PublicLinkPage /> },
    ],
  },

  // Authenticated app
  protectedRoute("/dashboard", <DashboardPage />),
  protectedRoute("/files", <FilesPage />),
  protectedRoute("/files/:folderId", <FilesPage />),
  protectedRoute("/shared", <SharedPage />),
  protectedRoute("/trash", <TrashPage />),
  protectedRoute("/storage", <StoragePage />),
  protectedRoute("/providers", <ProvidersPage />),
  protectedRoute("/recents", <RecentsPage />),
  protectedRoute("/notifications", <NotificationsPage />),
  protectedRoute("/api-keys", <ApiKeysPage />),
  protectedRoute("/webhooks", <WebhooksPage />),
  protectedRoute("/billing", <BillingPage />),
  protectedRoute("/settings", <SettingsPage />),
  protectedRoute("/admin", <AdminPage />, true),

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
