import MarkdownDocument, { RuleType, type MarkdownToJSX } from "markdown-to-jsx/react";
import { useMemo } from "react";

import { openFenceBody } from "../lib/markdown";
import { cn } from "../lib/utils";
import { MarkdownCodeBlock } from "./markdown-code-block";
import { MarkdownLink } from "./markdown-link";
import { MarkdownMedia } from "./remote-media";
import { MarkdownMediaLink } from "./remote-media-link";

const LIST = "flex list-outside flex-col gap-1 pl-5 marker:text-text-tertiary";

const OVERRIDES: MarkdownToJSX.Overrides = {
  h1: { props: { className: "text-lg font-semibold text-foreground" } },
  h2: { props: { className: "text-md font-semibold text-foreground" } },
  h3: { props: { className: "text-base font-semibold text-foreground" } },
  h4: { props: { className: "text-sm font-semibold text-foreground" } },
  h5: { props: { className: "text-sm font-semibold text-text-secondary" } },
  h6: { props: { className: "text-xs font-semibold uppercase text-text-secondary" } },
  p: { props: { className: "whitespace-pre-wrap" } },
  a: { component: MarkdownLink },
  strong: { props: { className: "font-semibold" } },
  em: { props: { className: "italic" } },
  del: { props: { className: "text-text-tertiary line-through" } },
  code: {
    props: {
      className:
        "mono rounded-sm border border-border-subtle bg-surface-2 px-1 py-px text-[0.92em] [overflow-wrap:anywhere]",
    },
  },
  ul: { props: { className: `${LIST} list-disc` } },
  ol: { props: { className: `${LIST} list-decimal` } },
  li: { props: { className: "min-w-0 has-[input]:list-none" } },
  blockquote: {
    props: {
      className: "flex flex-col gap-2 border-l-2 border-border-strong pl-3 text-text-secondary",
    },
  },
  hr: { props: { className: "border-t border-border-subtle" } },
  table: { props: { className: "block w-max max-w-full overflow-auto text-left" } },
  th: { props: { className: "border border-border-subtle px-2 py-1 font-semibold" } },
  td: { props: { className: "border border-border-subtle px-2 py-1 align-top" } },
};

export interface MarkdownProps {
  /** Untrusted Markdown. Raw HTML is never interpreted; it renders as literal text. */
  value: string;
  className?: string;
  allowMedia?: boolean;
}

/** The one renderer for Linear descriptions, agent messages and report prose. Streaming
    suppression stays off: an unclosed `**` must keep its characters, not swallow them. */
export function Markdown({ value, className, allowMedia = false }: MarkdownProps) {
  const options = useMemo<MarkdownToJSX.Options>(() => {
    const streaming = openFenceBody(value)?.trimEnd() ?? null;
    return {
      disableParsingRawHTML: true,
      disableFrontmatter: true,
      forceBlock: true,
      wrapper: null,
      overrides: allowMedia ? { ...OVERRIDES, a: { component: MarkdownMediaLink } } : OVERRIDES,
      renderRule(next, node, _renderChildren, state) {
        if (node.type === RuleType.codeBlock) {
          const code = node.text.trimEnd();
          return (
            <MarkdownCodeBlock
              key={state.key}
              language={node.lang ?? null}
              value={code}
              closed={streaming === null || code !== streaming}
            />
          );
        }
        if (node.type === RuleType.image) {
          if (allowMedia && node.target !== null) {
            return (
              <MarkdownMedia key={state.key} href={node.target} kind="image" label={node.alt} />
            );
          }
          return (
            <MarkdownLink key={state.key} href={node.target}>
              {node.alt ?? node.target}
            </MarkdownLink>
          );
        }
        if (node.type === RuleType.gfmTask) {
          return (
            <input
              key={state.key}
              type="checkbox"
              checked={node.completed}
              readOnly
              disabled
              className="mt-1 accent-iris"
              aria-label={node.completed ? "Done" : "Not done"}
            />
          );
        }
        return next();
      },
    };
  }, [allowMedia, value]);

  return (
    // The leading comes last: every caller sets a text size, and tailwind-merge drops a
    // `leading-*` that an equally specific `text-*` follows.
    <div className={cn("flex min-w-0 flex-col gap-3 break-words", className, "leading-[1.65]")}>
      <MarkdownDocument options={options}>{value}</MarkdownDocument>
    </div>
  );
}
