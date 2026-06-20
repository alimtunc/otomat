import { AlertTriangle, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../primitives/button";
import { EmptyState, type EmptyStateVariant } from "./empty-state";

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  retryLabel?: ReactNode;
  onRetry?: () => void;
  retryDisabled?: boolean;
  action?: ReactNode;
  variant?: EmptyStateVariant;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description,
  icon = AlertTriangle,
  retryLabel = "Retry",
  onRetry,
  retryDisabled = false,
  action,
  variant = "full",
  className,
}: ErrorStateProps) {
  const retry = onRetry ? (
    <Button variant="outline" size="sm" onClick={onRetry} disabled={retryDisabled}>
      <RefreshCw aria-hidden="true" />
      {retryLabel}
    </Button>
  ) : null;

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      tone="error"
      variant={variant}
      className={className}
      action={action ?? retry}
    />
  );
}
