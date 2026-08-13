import { contextReferenceKey, type ContextReference } from "@otomat/domain";
import { Button, Icon, Input, Popover, PopoverContent, PopoverTrigger } from "@otomat/ui";
import { useRepositoryFiles } from "@web/api/daemon/queries";
import { useProjectIssues } from "@web/api/issues/queries";
import { ContextSearchResults } from "@web/components/context/context-search-results";
import { searchIssues } from "@web/lib/issue/search";
import { useState } from "react";

/** Enough to choose from without turning the popover into a list view. */
const MAX_ISSUE_RESULTS = 8;

export interface AddContextPopoverProps {
  projectId: string | undefined;
  /** Null when the project has no usable repository; file attachment then says so. */
  repositoryId: string | null;
  /** Reference keys already attached, so the picker never offers the same thing twice. */
  attachedKeys: ReadonlySet<string>;
  onAdd: (reference: ContextReference) => void;
  label: string;
}

/** Searches what the project already knows — cached issues and tracked paths — and attaches one by identity. */
export function AddContextPopover({
  projectId,
  repositoryId,
  attachedKeys,
  onAdd,
  label,
}: AddContextPopoverProps) {
  const [query, setQuery] = useState("");
  const issues = useProjectIssues(projectId);
  const files = useRepositoryFiles(repositoryId, query);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            <Icon name="plus" aria-hidden />
            Add context
          </Button>
        }
      />
      <PopoverContent align="start" className="flex w-80 flex-col gap-2 p-2">
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search issues and files"
          aria-label={`${label} context search`}
          className="h-7 text-sm"
        />
        <ContextSearchResults
          issues={searchIssues(issues.data ?? [], query)
            .filter(
              (issue) =>
                !attachedKeys.has(contextReferenceKey({ kind: "issue", issue_id: issue.id })),
            )
            .slice(0, MAX_ISSUE_RESULTS)}
          paths={(files.data?.paths ?? []).filter(
            (path) => !attachedKeys.has(contextReferenceKey({ kind: "file", path })),
          )}
          omittedPaths={files.data?.omitted ?? 0}
          repositoryId={repositoryId}
          filesFailed={files.isError}
          onAdd={onAdd}
        />
      </PopoverContent>
    </Popover>
  );
}
