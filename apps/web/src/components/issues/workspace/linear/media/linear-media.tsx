import { MarkdownMedia } from "@otomat/ui";

import { isLinearUpload } from "./upload";
import { UploadFigure, type UploadFigureProps } from "./upload-figure";

/** Linear uploads answer only to the connection key, so they go through the daemon; any other host loads directly. */
export function LinearMedia({ issueId, ...props }: UploadFigureProps) {
  if (!isLinearUpload(props.href)) return <MarkdownMedia {...props} />;
  return <UploadFigure issueId={issueId} {...props} />;
}
