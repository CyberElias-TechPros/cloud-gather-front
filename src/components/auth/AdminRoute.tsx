import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogoMark } from "@/components/brand/Logo";

interface AdminRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Gate for admin-only areas. Authorization is checked against the
 * `is_admin_user()` SECURITY DEFINER RPC (via AuthContext) — never against a
 * client-readable table, so a regular user cannot discover admin identities.
 */
const AdminRoute: React.FC<AdminRouteProps> = ({ children, redirectTo = "/dashboard" }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3" role="status" aria-live="polite">
        <LogoMark className="h-10 w-10 animate-pulse" />
        <span className="text-sm text-muted-foreground">Checking permissions…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};

export default AdminRoute;
