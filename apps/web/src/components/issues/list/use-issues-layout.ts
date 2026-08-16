import {
  DEFAULT_ISSUES_LAYOUT,
  readIssuesLayout,
  writeIssuesLayout,
  type IssuesLayout,
} from "@web/lib/issue/layout";
import { useState } from "react";

export interface IssuesLayoutResult {
  layout: IssuesLayout;
  select: (layout: IssuesLayout) => void;
}

function storedLayout(projectId: string | undefined): IssuesLayout {
  return projectId === undefined ? DEFAULT_ISSUES_LAYOUT : readIssuesLayout(projectId);
}

export function useIssuesLayout(projectId: string | undefined): IssuesLayoutResult {
  const [state, setState] = useState(() => ({ projectId, layout: storedLayout(projectId) }));
  if (state.projectId !== projectId) setState({ projectId, layout: storedLayout(projectId) });

  return {
    layout: state.layout,
    select: (layout) => {
      setState({ projectId, layout });
      if (projectId !== undefined) writeIssuesLayout(projectId, layout);
    },
  };
}
