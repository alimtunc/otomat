import type { ReactNode } from "react";

import { markdownMediaKind } from "../lib/markdown/media";
import { MarkdownLink } from "./markdown-link";
import { MarkdownMedia } from "./remote-media";

export interface MarkdownMediaLinkProps {
  href?: string | null;
  children: ReactNode;
}

export function MarkdownMediaLink({ href, children }: MarkdownMediaLinkProps) {
  const kind = href === null || href === undefined ? null : markdownMediaKind(href);
  if (href === null || href === undefined || kind === null) {
    return <MarkdownLink href={href}>{children}</MarkdownLink>;
  }
  return (
    <MarkdownMedia href={href} kind={kind} label={typeof children === "string" ? children : null} />
  );
}
