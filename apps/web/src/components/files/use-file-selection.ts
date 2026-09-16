import type { CheckoutTarget } from "@otomat/domain";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { fileScope } from "@web/components/files/scope";
import { useActiveHostId } from "@web/lib/active-host";
import { asString } from "@web/lib/coerce";
import { readScoped, writeScoped } from "@web/lib/storage";
import { useEffect } from "react";

const SELECTION_KEY = "otomat.files.selection";

export function useFileSelection(target: CheckoutTarget) {
  const { file, fileScope: selectedScope } = useSearch({ strict: false });
  const navigate = useNavigate();
  const scope = fileScope(useActiveHostId(), target);
  const remembered = readScoped(SELECTION_KEY, scope, asString);
  const path =
    selectedScope === undefined || selectedScope === scope ? (file ?? remembered) : remembered;

  // otomat-allow-effect: remember only committed navigation, including files opened from the global picker.
  useEffect(() => {
    if (file !== undefined && (selectedScope === undefined || selectedScope === scope))
      writeScoped(SELECTION_KEY, scope, file);
  }, [file, selectedScope, scope]);

  return {
    scope,
    path,
    select: (next: string, openInChanges = false): void => {
      void navigate({
        to: ".",
        search: (previous) => ({
          ...previous,
          changes: openInChanges || undefined,
          file: next,
          fileScope: scope,
        }),
        replace: true,
        resetScroll: false,
      });
    },
  };
}
