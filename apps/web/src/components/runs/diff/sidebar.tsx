import type { DiffFileContract, ReviewCommentContract, ReviewDiffContract } from "@otomat/domain";
import { Icon, Pill, PillTabs, SidePanelToggle } from "@otomat/ui";
import { DiffFileBrowser } from "@web/components/runs/diff/files/browser";
import type { DiffBrowserMode } from "@web/components/runs/diff/prefs/prefs";
import { DiffStat } from "@web/components/runs/diff/stat";
import { PaneHeader } from "@web/components/runs/pane-header";
import { ReviewCommentsPanel } from "@web/components/runs/review/comments-panel";
import { useState } from "react";

export interface DiffSidebarProps {
  diff: ReviewDiffContract;
  browserMode: DiffBrowserMode;
  stats: boolean;
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelectFile: (file: DiffFileContract) => void;
  comments: ReviewCommentContract[];
  anchoredCommentIds: ReadonlySet<string>;
  onSelectComment: (comment: ReviewCommentContract) => void;
}

export function DiffSidebar({
  diff,
  browserMode,
  stats,
  activePath,
  reviewedPaths,
  onSelectFile,
  comments,
  anchoredCommentIds,
  onSelectComment,
}: DiffSidebarProps) {
  const [tab, setTab] = useState<"files" | "comments">("files");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <PaneHeader className="bg-sidebar">
        <PillTabs
          type="single"
          value={tab}
          onValueChange={(value) => {
            if (value === "files" || value === "comments") setTab(value);
          }}
          aria-label="Reviewer rail"
          className="-ml-1.5 border-0 bg-transparent normal-case"
        >
          <Pill value="files" icon={<Icon name="list" />}>
            Files
          </Pill>
          <Pill
            value="comments"
            icon={<Icon name="message-square" />}
            badge={comments.length === 0 ? undefined : comments.length}
          >
            Comments
          </Pill>
        </PillTabs>
        {stats ? (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-micro font-normal normal-case">
            <DiffStat additions={diff.additions} deletions={diff.deletions} />
          </span>
        ) : null}
        <SidePanelToggle className={stats ? "-mr-1.5" : "-mr-1.5 ml-auto"} />
      </PaneHeader>
      {tab === "files" ? (
        <DiffFileBrowser
          diff={diff}
          mode={browserMode}
          activePath={activePath}
          reviewedPaths={reviewedPaths}
          onSelect={onSelectFile}
        />
      ) : (
        <ReviewCommentsPanel
          comments={comments}
          anchoredIds={anchoredCommentIds}
          activeCommentId={activeCommentId}
          onSelect={(comment) => {
            setActiveCommentId(comment.id);
            onSelectComment(comment);
          }}
        />
      )}
    </div>
  );
}
