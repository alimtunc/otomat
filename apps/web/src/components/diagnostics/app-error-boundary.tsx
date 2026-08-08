import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorReport } from "./error-report";

export interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  caught: { error: unknown; occurredAt: Date } | null;
  componentStack: string | null;
}

/**
 * The last boundary before a blank window: it catches what escapes the router, so a renderer
 * exception always ends on a classified report with a way back instead of an empty page.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, BoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { caught: null, componentStack: null };
  }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { caught: { error, occurredAt: new Date() } };
  }

  override componentDidCatch(_error: unknown, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
  }

  override render(): ReactNode {
    const caught = this.state.caught;
    if (caught === null) return this.props.children;
    return (
      <ErrorReport
        error={caught.error}
        componentStack={this.state.componentStack}
        occurredAt={caught.occurredAt}
        retryLabel="Reload Otomat"
        onRetry={() => window.location.reload()}
      />
    );
  }
}
