import { CopyButton, Markdown } from "@otomat/ui";

import { MARKDOWN_SAMPLE, MARKDOWN_STREAMING_SAMPLE } from "../gallery.fixtures";
import { Section } from "../section";

export function MarkdownSection() {
  return (
    <Section title="Markdown · issues · agents · reports">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-1 p-4">
          <Markdown value={MARKDOWN_SAMPLE} className="text-sm" />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2">
            <span className="text-micro uppercase tracking-[0.06em] text-text-tertiary">
              Mid-stream
            </span>
            <span className="flex-1" />
            <CopyButton value={MARKDOWN_STREAMING_SAMPLE} label="Copy raw text" showLabel />
          </div>
          <Markdown value={MARKDOWN_STREAMING_SAMPLE} className="text-sm" />
        </div>
      </div>
    </Section>
  );
}
