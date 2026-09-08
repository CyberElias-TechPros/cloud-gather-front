import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors in a subtree and shows a recovery surface
 * instead of a white screen. Global (uncaught) errors are reported via the
 * window-level listeners installed in main.tsx.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Component-stack only; never log props/content that could hold secrets.
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center" role="alert">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">This section hit a snag</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            The rest of the app is still working. Try again, or head back to your dashboard.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again
            </Button>
            <Button onClick={() => (window.location.href = "/dashboard")}>
              <Home className="mr-2 h-4 w-4" aria-hidden="true" /> Dashboard
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
