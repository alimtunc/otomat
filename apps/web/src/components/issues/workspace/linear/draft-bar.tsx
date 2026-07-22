import { Button } from "@otomat/ui";

import { ConflictDialog } from "./conflict-dialog";
import type { LinearIssueEditing } from "./use-issue-editing";

export function DraftBar({ editing }: { editing: LinearIssueEditing }) {
  const { draft, conflict, values } = editing;
  if (draft === null && conflict === null) return null;

  return (
    <>
      {draft !== null ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-iris-solid/30 bg-iris-solid/8 py-1.5 pl-3 pr-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-iris-solid" />
          <span className="text-xs font-medium text-iris-text">Unpublished draft</span>
          <span className="text-xs text-text-tertiary">
            {editing.editorOffline
              ? "Linear is unreachable — your edits are safe locally."
              : "Edits stay local until you publish."}
          </span>
          <div className="flex-1" />
          <Button
            size="xs"
            variant="ghost"
            disabled={editing.saving || editing.publishing}
            onClick={editing.discard}
          >
            Discard
          </Button>
          <Button
            size="xs"
            variant="primary"
            loading={editing.publishing}
            disabled={editing.saving}
            onClick={() => void editing.publish(false)}
          >
            Publish to Linear
          </Button>
        </div>
      ) : null}

      {conflict !== null && values !== null ? (
        <ConflictDialog
          local={values}
          metadata={editing.metadata}
          remote={conflict}
          pending={editing.publishing || editing.saving}
          onOverwrite={() => void editing.publish(true)}
          onRefresh={editing.refreshFromLinear}
          onAbandon={editing.dismissConflict}
        />
      ) : null}
    </>
  );
}
