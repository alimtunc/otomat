import { MarkdownMediaContext, type MarkdownMediaRenderer } from "@otomat/ui";
import { useCallback, type ReactNode } from "react";

import { LinearMedia } from "./linear-media";

export function LinearMediaProvider({
  issueId,
  children,
}: {
  issueId: string;
  children: ReactNode;
}) {
  const renderLinearMedia = useCallback<MarkdownMediaRenderer>(
    (props) => <LinearMedia issueId={issueId} {...props} />,
    [issueId],
  );
  return (
    <MarkdownMediaContext.Provider value={renderLinearMedia}>
      {children}
    </MarkdownMediaContext.Provider>
  );
}
