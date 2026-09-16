import type { CheckoutTarget, WorktreeFileContent } from "@otomat/domain";
import { Button, Kbd, Spinner } from "@otomat/ui";
import { useBlocker } from "@tanstack/react-router";
import { useSaveFile } from "@web/api/files/mutations";
import type { CodeEditorHandle } from "@web/components/files/code-editor";
import { CopyablePath } from "@web/components/runs/copyable-path";
import { CenteredState } from "@web/components/shell/centered-state";
import { worktreeFileRefusal } from "@web/lib/run/file-refusal";
import { lazy, Suspense, useRef, useState } from "react";

const CodeEditor = lazy(() =>
  import("@web/components/files/code-editor").then((m) => ({ default: m.CodeEditor })),
);

const DISCARD_PROMPT = "This file has unsaved changes. Leave and discard them?";

type TextContent = Extract<WorktreeFileContent, { kind: "text" }>;

export interface FileEditorProps {
  target: CheckoutTarget;
  content: TextContent;
  editable: boolean;
  refreshing: boolean;
  onReload: () => void;
}

export function FileEditor({ target, content, editable, refreshing, onReload }: FileEditorProps) {
  const save = useSaveFile(target);
  const editor = useRef<CodeEditorHandle>(null);
  const [dirty, setDirty] = useState(false);
  const [opened, setOpened] = useState(content.revision);
  const [reloads, setReloads] = useState(0);
  // Every route change, including picking another file, goes through the router, so one blocker covers them all; the browser's own prompt covers closing the tab.
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm(DISCARD_PROMPT),
    enableBeforeUnload: dirty,
  });

  const moved = content.revision !== opened;
  if (moved && !dirty) setOpened(content.revision);
  const conflict = (moved && dirty) || worktreeFileRefusal(save.error) === "file_revision_stale";

  const saveNow = (text: string): void => {
    if (!editable || conflict || save.isPending) return;
    save.mutate(
      { path: content.path, revision: opened, text },
      {
        onSuccess: (saved) => {
          setOpened(saved.revision);
          setDirty(false);
        },
      },
    );
  };

  const reload = (): void => {
    save.reset();
    setDirty(false);
    setOpened(content.revision);
    setReloads((count) => count + 1);
    onReload();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border-subtle px-3 py-1.5">
        <CopyablePath value={content.path} label="File path" />
        <span className="ml-auto flex shrink-0 items-center gap-2 text-micro text-text-tertiary">
          {dirty ? (
            <span className="text-warning">Unsaved changes</span>
          ) : (
            <span>{editable ? "Saved" : "Read-only"}</span>
          )}
          {editable ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              loading={save.isPending}
              disabled={!dirty || conflict}
              onClick={() => saveNow(editor.current?.read() ?? content.text)}
            >
              Save <Kbd>⌘S</Kbd>
            </Button>
          ) : null}
        </span>
      </div>
      {conflict ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-warning-bg px-3 py-1.5 text-xs text-foreground">
          <p>
            This file changed on disk since it was opened. Saving would overwrite that change;
            reload to see it and discard your edits.
          </p>
          <Button type="button" size="xs" variant="outline" loading={refreshing} onClick={reload}>
            Reload
          </Button>
        </div>
      ) : null}
      <Suspense
        fallback={
          <CenteredState fill="flex">
            <Spinner label="Loading the editor" />
          </CenteredState>
        }
      >
        <CodeEditor
          ref={editor}
          path={content.path}
          doc={content.text}
          docKey={`${opened}:${reloads}`}
          readOnly={!editable}
          onDirtyChange={setDirty}
          onSave={saveNow}
        />
      </Suspense>
    </div>
  );
}
