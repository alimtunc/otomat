import { useContext, type ReactNode } from "react";

import { markdownMediaKind } from "../lib/markdown/media";
import { MarkdownLink } from "./markdown-link";
import { MarkdownMediaContext } from "./media-context";

export interface MarkdownMediaLinkProps {
  href?: string | null;
  children: ReactNode;
}

function plainText(node: ReactNode): string | null {
  if (typeof node === "string") return node;
  if (!Array.isArray(node)) return null;
  const parts = node.map(plainText);
  return parts.every((part) => part !== null) ? parts.join("") : null;
}

export function MarkdownMediaLink({ href, children }: MarkdownMediaLinkProps) {
  const renderMedia = useContext(MarkdownMediaContext);
  const kind = href === null || href === undefined ? null : markdownMediaKind(href);
  if (href === null || href === undefined || kind === null) {
    return <MarkdownLink href={href}>{children}</MarkdownLink>;
  }
  return renderMedia({ href, kind, label: plainText(children) });
}
