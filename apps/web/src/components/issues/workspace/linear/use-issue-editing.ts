import type {
  LinearIssueDraft,
  LinearIssueSnapshot,
  LinearTeamMetadata,
  LinearWriteContract,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import {
  linearWriteConflict,
  useDiscardLinearDraft,
  useLinearEditor,
  useLinearWriteback,
  usePublishLinearFields,
  useSaveLinearDraft,
} from "@web/api/linear/writeback";
import { useState } from "react";

import { editableFieldsFrom, sameEditableFields, type EditorFormValues } from "./editable-fields";

export interface LinearIssueEditing {
  values: EditorFormValues | null;
  snapshot: LinearIssueSnapshot | null;
  metadata: LinearTeamMetadata | null;
  draft: LinearIssueDraft | null;
  writes: LinearWriteContract[];
  editorOffline: boolean;
  writebackOffline: boolean;
  canEdit: boolean;
  saving: boolean;
  publishing: boolean;
  conflict: LinearIssueSnapshot | null;
  updateFields: (partial: Partial<EditorFormValues>) => void;
  publish: (overwrite: boolean) => Promise<void>;
  discard: () => void;
  dismissConflict: () => void;
  refreshFromLinear: () => void;
  retryEditor: () => void;
  retryWriteback: () => void;
}

export function useLinearIssueEditing(issueId: string): LinearIssueEditing {
  const writeback = useLinearWriteback(issueId);
  const editor = useLinearEditor(issueId);
  const saveDraft = useSaveLinearDraft(issueId);
  const discardDraft = useDiscardLinearDraft(issueId);
  const publishFields = usePublishLinearFields(issueId);
  const [conflict, setConflict] = useState<LinearIssueSnapshot | null>(null);

  const draft = writeback.data?.draft ?? null;
  const snapshot = editor.data?.snapshot ?? null;
  const editingBase = draft ?? snapshot;
  const values = editingBase === null ? null : editableFieldsFrom(editingBase);
  const base = draft?.base_updated_at ?? snapshot?.updated_at ?? null;

  function updateFields(partial: Partial<EditorFormValues>): void {
    if (values === null || base === null) return;
    const next = { ...values, ...partial };
    if (snapshot !== null && sameEditableFields(next, snapshot)) {
      if (draft !== null) discardDraft.mutate();
      return;
    }
    saveDraft.mutate({ base_updated_at: base, ...next });
  }

  async function publish(overwrite: boolean): Promise<void> {
    try {
      await publishFields.mutateAsync({ overwrite });
      setConflict(null);
      toast.success("Published changes to Linear");
    } catch (error) {
      const remote = linearWriteConflict(error)?.remote ?? null;
      if (remote !== null) setConflict(remote);
    }
  }

  return {
    values,
    snapshot,
    metadata: editor.data?.team_metadata ?? null,
    draft,
    writes: writeback.data?.writes ?? [],
    editorOffline: editor.isError,
    writebackOffline: writeback.isError && writeback.data === undefined,
    canEdit: values !== null && base !== null,
    saving: saveDraft.isPending || discardDraft.isPending,
    publishing: publishFields.isPending,
    conflict,
    updateFields,
    publish,
    discard: () => {
      discardDraft.mutate(undefined, {
        onSuccess: () => toast.success("Discarded local draft"),
      });
    },
    dismissConflict: () => setConflict(null),
    refreshFromLinear: () => {
      discardDraft.mutate(undefined, {
        onSuccess: () => {
          setConflict(null);
          toast.success("Reloaded the issue from Linear");
        },
      });
    },
    retryEditor: () => void editor.refetch(),
    retryWriteback: () => void writeback.refetch(),
  };
}
