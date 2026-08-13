import { ViewDeleteDialog } from "@web/components/issues/views/delete-dialog";
import { IssueViewMenu } from "@web/components/issues/views/menu";
import { ViewNameDialog } from "@web/components/issues/views/name-dialog";
import { namePrompt, type NamePromptKind } from "@web/components/issues/views/name-prompt";
import { IssueViewTabs } from "@web/components/issues/views/tabs";
import { UnsavedViewActions } from "@web/components/issues/views/unsaved-actions";
import type { IssueViewsResult } from "@web/components/issues/views/use-issue-views";
import { orderedViews, type SavedView } from "@web/lib/issue/saved-view";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";
import { TOOLBAR_STRIP } from "@web/lib/toolbar";
import { useState } from "react";

export interface IssueViewBarProps {
  views: IssueViewsResult;
  active: SavedView;
  /** What the screen shows right now, saved as-is by "Save changes" and by a new view. */
  config: IssuesViewConfig;
  dirty: boolean;
  onOpenView: (viewId: string) => void;
}

export function IssueViewBar({ views, active, config, dirty, onOpenView }: IssueViewBarProps) {
  const [promptKind, setPromptKind] = useState<NamePromptKind | null>(null);
  const [deleting, setDeleting] = useState(false);
  const editable = active.id !== views.set.system.id;
  const index = views.set.saved.findIndex((view) => view.id === active.id);
  const prompt = promptKind === null ? null : namePrompt(promptKind, active.name);

  const submitName = (name: string): void => {
    if (promptKind === "rename") views.rename(active.id, name);
    else onOpenView(views.create(name, config).id);
    setPromptKind(null);
  };

  return (
    <div className={TOOLBAR_STRIP}>
      <IssueViewTabs
        views={orderedViews(views.set)}
        activeId={active.id}
        dirty={dirty}
        onSelect={(id) => {
          views.select(id);
          onOpenView(id);
        }}
      />
      <div className="flex-1" />
      {dirty ? (
        <UnsavedViewActions
          savable={editable}
          onSave={() => {
            views.store(active.id, config);
            onOpenView(active.id);
          }}
          onSaveAs={() => setPromptKind("saveAs")}
          onReset={() => onOpenView(active.id)}
        />
      ) : null}
      <IssueViewMenu
        name={active.name}
        editable={editable}
        movable={{ left: index > 0, right: index >= 0 && index < views.set.saved.length - 1 }}
        onRename={() => setPromptKind("rename")}
        onDuplicate={() => setPromptKind("duplicate")}
        onMove={(offset) => views.move(active.id, offset)}
        onDelete={() => setDeleting(true)}
      />
      {prompt === null ? null : (
        <ViewNameDialog
          open
          title={prompt.title}
          submitLabel={prompt.submitLabel}
          initialName={prompt.name}
          onOpenChange={(next) => {
            if (!next) setPromptKind(null);
          }}
          onSubmit={submitName}
        />
      )}
      <ViewDeleteDialog
        name={active.name}
        dirty={dirty}
        open={deleting}
        onOpenChange={setDeleting}
        onConfirm={() => {
          views.remove(active.id);
          setDeleting(false);
          onOpenView(views.set.system.id);
        }}
      />
    </div>
  );
}
