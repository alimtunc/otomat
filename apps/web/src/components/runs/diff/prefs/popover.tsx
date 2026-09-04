import { isReviewCommentDestination } from "@otomat/domain";
import {
  Button,
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  SegmentedItem,
  Switch,
} from "@otomat/ui";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import type { ReactNode } from "react";

export interface DiffPrefsPopoverProps {
  prefs: DiffPrefs;
  onChange: (patch: Partial<DiffPrefs>) => void;
  /** False when the layout shows no file sidebar, so a Files/Tree choice would steer nothing. */
  browsable: boolean;
}

function PrefRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-text-secondary">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function DiffPrefsPopover({ prefs, onChange, browsable }: DiffPrefsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm">
            <Icon name="sliders-horizontal" aria-hidden />
            View
          </Button>
        }
      />
      <PopoverContent align="end" className="flex w-64 flex-col gap-2.5 p-3">
        <PrefRow label="Layout">
          <SegmentedControl
            type="single"
            value={prefs.mode}
            onValueChange={(value) => {
              if (value === "unified" || value === "split") onChange({ mode: value });
            }}
            aria-label="Diff view mode"
          >
            <SegmentedItem value="unified" icon={<Icon name="rows-3" />}>
              Unified
            </SegmentedItem>
            <SegmentedItem value="split" icon={<Icon name="columns-3" />}>
              Split
            </SegmentedItem>
          </SegmentedControl>
        </PrefRow>
        {browsable ? (
          <PrefRow label="Browser">
            <SegmentedControl
              type="single"
              value={prefs.browser}
              onValueChange={(value) => {
                if (value === "files" || value === "tree") onChange({ browser: value });
              }}
              aria-label="File browser mode"
            >
              <SegmentedItem value="files" icon={<Icon name="list" />}>
                Files
              </SegmentedItem>
              <SegmentedItem value="tree" icon={<Icon name="list-tree" />}>
                Tree
              </SegmentedItem>
            </SegmentedControl>
          </PrefRow>
        ) : null}
        <PrefRow label="Sort files">
          <SegmentedControl
            type="single"
            value={prefs.sort}
            onValueChange={(value) => {
              if (value === "path" || value === "changes") onChange({ sort: value });
            }}
            aria-label="File sort order"
          >
            <SegmentedItem value="path">Path</SegmentedItem>
            <SegmentedItem value="changes">Changes</SegmentedItem>
          </SegmentedControl>
        </PrefRow>
        <PrefRow label="Grouping">
          <SegmentedControl
            type="single"
            value={prefs.grouping}
            onValueChange={(value) => {
              if (value === "none" || value === "type") onChange({ grouping: value });
            }}
            aria-label="File grouping"
          >
            <SegmentedItem value="none">None</SegmentedItem>
            <SegmentedItem value="type">File type</SegmentedItem>
          </SegmentedControl>
        </PrefRow>
        <PrefRow label="Wrap lines">
          <Switch
            checked={prefs.wrap}
            onCheckedChange={(wrap) => onChange({ wrap })}
            aria-label="Wrap lines"
          />
        </PrefRow>
        <PrefRow label="Statistics">
          <Switch
            checked={prefs.stats}
            onCheckedChange={(stats) => onChange({ stats })}
            aria-label="Show statistics"
          />
        </PrefRow>
        <PrefRow label="Comment goes to">
          <SegmentedControl
            type="single"
            value={prefs.commentDestination}
            onValueChange={(value) => {
              if (isReviewCommentDestination(value)) onChange({ commentDestination: value });
            }}
            aria-label="Default comment destination"
          >
            <SegmentedItem value="agent" icon={<Icon name="bot" />}>
              Agent
            </SegmentedItem>
            <SegmentedItem value="pr_review" icon={<Icon name="git-pull-request" />}>
              PR review
            </SegmentedItem>
          </SegmentedControl>
        </PrefRow>
        <PrefRow label="Hide reviewed">
          <Switch
            checked={prefs.hideReviewed}
            onCheckedChange={(hideReviewed) => onChange({ hideReviewed })}
            aria-label="Hide reviewed files"
          />
        </PrefRow>
      </PopoverContent>
    </Popover>
  );
}
