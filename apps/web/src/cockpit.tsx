import { ThemeProvider, Toaster } from "@otomat/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient } from "@web/api/query-client";
import { AppErrorBoundary } from "@web/components/diagnostics/app-error-boundary";
import { PreviewBlocked } from "@web/components/preview/blocked";
import { previewSession } from "@web/preview/session";
import { router } from "@web/router";

export function Cockpit() {
  const preview = previewSession();
  return (
    <ThemeProvider>
      {preview?.state === "blocked" ? (
        <PreviewBlocked cause={preview.cause} expected={preview.manifest?.build ?? null} />
      ) : (
        <QueryClientProvider client={queryClient}>
          <AppErrorBoundary>
            <RouterProvider router={router} />
          </AppErrorBoundary>
          <Toaster />
        </QueryClientProvider>
      )}
    </ThemeProvider>
  );
}
