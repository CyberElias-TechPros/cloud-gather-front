import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogoMark } from "@/components/brand/Logo";
import { siteConfig } from "@/lib/site";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Gate for authenticated areas. While the session is being restored we show a
 * branded splash rather than flashing the login page; after login the user is
 * returned to the page they originally requested via location.state.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, redirectTo = "/login" }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4" role="status" aria-live="polite">
        <LogoMark className="h-10 w-10 animate-pulse" />
        <span className="sr-only">Loading {siteConfig.name}…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
