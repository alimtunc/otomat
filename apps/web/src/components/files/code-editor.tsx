import { Editor, type OnMount } from "@monaco-editor/react";
import { Spinner, useTheme } from "@otomat/ui";
import { EDITOR_OPTIONS, editorTheme } from "@web/components/files/monaco-setup";
import { CenteredState } from "@web/components/shell/centered-state";
import { KeyCode, KeyMod } from "monaco-editor/editor/editor.api";
import { useEffect, useEffectEvent, useImperativeHandle, useMemo, useState, type Ref } from "react";

export interface CodeEditorHandle {
  read(): string;
}

export interface CodeEditorProps {
  path: string;
  doc: string;
  /** Changing it replaces the document with `doc` and marks the editor clean. */
  docKey: string;
  readOnly: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (text: string) => void;
  ref?: Ref<CodeEditorHandle>;
}

type MonacoEditor = Parameters<OnMount>[0];

export function CodeEditor({
  path,
  doc,
  docKey,
  readOnly,
  onDirtyChange,
  onSave,
  ref,
}: CodeEditorProps) {
  const { theme } = useTheme();
  const themeName = useMemo(() => editorTheme(theme), [theme]);
  const [editor, setEditor] = useState<MonacoEditor | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  const markSaved = useEffectEvent((current: MonacoEditor) => {
    setSavedVersion(current.getModel()?.getAlternativeVersionId() ?? null);
    onDirtyChange(false);
  });
  const reportDirty = useEffectEvent((current: MonacoEditor) => {
    const version = current.getModel()?.getAlternativeVersionId() ?? null;
    onDirtyChange(version !== savedVersion);
  });
  const save = useEffectEvent((current: MonacoEditor) => onSave(current.getValue()));

  useImperativeHandle(ref, () => ({ read: () => editor?.getValue() ?? doc }), [editor, doc]);

  // otomat-allow-effect: Monaco's change listener and the save command are wired once its instance exists, outside React's render.
  useEffect(() => {
    if (editor === null) return;
    markSaved(editor);
    const listener = editor.onDidChangeModelContent(() => reportDirty(editor));
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => save(editor));
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP, () =>
      editor.trigger("keyboard", "editor.action.quickCommand", null),
    );
    return () => listener.dispose();
  }, [editor]);

  // otomat-allow-effect: a new document key means the worktree's content replaces whatever is typed, inside Monaco's own model.
  useEffect(() => {
    if (editor === null) return;
    if (editor.getValue() !== doc) editor.setValue(doc);
    markSaved(editor);
  }, [docKey]);

  return (
    <div className="min-h-0 flex-1 overflow-hidden" aria-label={path}>
      <Editor
        path={path}
        defaultValue={doc}
        theme={themeName}
        options={{ ...EDITOR_OPTIONS, readOnly }}
        onMount={setEditor}
        loading={
          <CenteredState fill="flex">
            <Spinner label="Loading the editor" />
          </CenteredState>
        }
      />
    </div>
  );
}
