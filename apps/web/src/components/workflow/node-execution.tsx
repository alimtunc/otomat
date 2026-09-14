import { Button, Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@otomat/ui";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import type { WorkflowPlanExecution } from "@web/components/workflow/plan-execution";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { hasWorkflowExecutionOverride } from "@web/lib/workflow/content";
import { useState } from "react";

export interface WorkflowNodeExecutionProps {
  value: ExecutionSelection;
  onChange: (selection: ExecutionSelection) => void;
  execution: WorkflowPlanExecution;
  label: string;
}

export function WorkflowNodeExecution({
  value,
  onChange,
  execution,
  label,
}: WorkflowNodeExecutionProps) {
  const [editing, setEditing] = useState(false);
  const explicit = hasWorkflowExecutionOverride(value);
  const picker = (
    <ExecutionConfigPicker
      compact
      level="step"
      value={value}
      onChange={onChange}
      inherited={execution.inherited}
      profiles={execution.agents.profiles}
      descriptors={execution.agents.descriptors}
      skills={execution.agents.skills}
      label={label}
    />
  );
  return (
    <Collapsible open={explicit || editing} onOpenChange={setEditing}>
      <CollapsibleTrigger
        hidden={explicit}
        render={<Button size="xs" variant="ghost" />}
        aria-label={`Override ${label} execution`}
      >
        Override execution
      </CollapsibleTrigger>
      <CollapsiblePanel>{picker}</CollapsiblePanel>
    </Collapsible>
  );
}
