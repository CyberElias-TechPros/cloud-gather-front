import React from "react";
import { useNavigate, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { Seo } from "@/components/common/Seo";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

/**
 * Global error boundary page. Rendered whenever a route throws or the router
 * fails — deliberately standalone (no app chrome) so it always works.
 */
const ErrorPage: React.FC = () => {
  const navigate = useNavigate();
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="flex min-h-screen flex-col">
      <Seo
        title={is404 ? "Page not found" : "Something went wrong"}
        description="An error occurred."
        noIndex
      />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <Logo />
        <div className="mx-auto mt-12 max-w-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">
            {is404 ? "Page not found" : "Something went wrong"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {is404
              ? "The page you requested doesn't exist."
              : "An unexpected error occurred. It has been logged — try again, and if it keeps happening, let us know."}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={() => navigate("/")}>
              <Home className="mr-2 h-4 w-4" aria-hidden="true" /> Back to home
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Reload page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
