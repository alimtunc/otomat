import type { ReactNode } from "react";

import { isExternalHref, safeHref } from "../lib/markdown";

const LINK =
  "text-iris-text underline decoration-iris-text/40 underline-offset-2 hover:decoration-iris-text [overflow-wrap:anywhere]";

export interface MarkdownLinkProps {
  href?: string | null;
  children: ReactNode;
}

/** Every destination the renderer emits passes here, so a scheme the allowlist rejects
    keeps its label as inert text instead of becoming a link. */
export function MarkdownLink({ href, children }: MarkdownLinkProps) {
  const destination = href === null || href === undefined ? null : safeHref(href);
  if (destination === null) return <>{children}</>;
  const external = isExternalHref(destination);
  return (
    <a
      href={destination}
      title={destination}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className={LINK}
    >
      {children}
      {external ? <span className="sr-only"> (opens {destination} in a new tab)</span> : null}
    </a>
  );
}
