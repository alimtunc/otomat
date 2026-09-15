import { useNavigate, useSearch } from "@tanstack/react-router";
import { readStored, writeStored } from "@web/lib/storage";
import { useEffect } from "react";

export function useFileSelection(scope: string) {
  const { file, fileScope } = useSearch({ strict: false });
  const navigate = useNavigate();
  const key = `otomat.files.selection:${scope}`;
  const path =
    fileScope === undefined || fileScope === scope ? (file ?? readStored(key)) : readStored(key);

  // otomat-allow-effect: remember only committed navigation, including files opened from the global picker.
  useEffect(() => {
    if (file !== undefined && (fileScope === undefined || fileScope === scope))
      writeStored(key, file);
  }, [file, fileScope, scope, key]);

  return {
    path,
    select: (next: string, changes = false): void => {
      void navigate({
        to: ".",
        search: (previous) => ({
          ...previous,
          changes: changes || undefined,
          file: next,
          fileScope: scope,
        }),
        replace: true,
        resetScroll: false,
      });
    },
  };
}
