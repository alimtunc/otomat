import { useCanGoBack, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { backTarget } from "@web/lib/back-target";

export interface BackNavigation {
  label: string;
  goBack: () => void;
}

export function useBackNavigation(linkedIssueId: string | null): BackNavigation | null {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const fallback = backTarget(pathname, linkedIssueId);
  if (fallback === null) return null;

  return {
    label: canGoBack ? "Back" : `Back to ${fallback.label}`,
    goBack: () => {
      if (canGoBack) {
        router.history.back();
        return;
      }
      void navigate({ to: fallback.href, replace: true });
    },
  };
}
