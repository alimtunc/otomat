import { Checkbox, Field, FieldControl, FieldLabel, Icon, Input, Switch } from "@otomat/ui";
import { useState } from "react";

import { Section } from "../section";

export function InputsSection() {
  const [autoStart, setAutoStart] = useState(true);
  const [coAuthored, setCoAuthored] = useState(false);
  const [reviewed, setReviewed] = useState(true);

  return (
    <Section title="Inputs & controls">
      <div className="flex flex-wrap items-start gap-6">
        <Field className="w-60" hint="Local git repository.">
          <FieldLabel>Repository path</FieldLabel>
          <FieldControl>
            <Input icon={<Icon name="folder" />} placeholder="/Users/…/web-app" />
          </FieldControl>
        </Field>

        <Field className="w-60" invalid error="Branch name contains a space.">
          <FieldLabel>Branch</FieldLabel>
          <FieldControl>
            <Input defaultValue="otomat/7-csv export" />
          </FieldControl>
        </Field>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="auto-start-daemon"
            className="flex items-center gap-2.5 text-sm text-text-secondary"
          >
            <Switch id="auto-start-daemon" checked={autoStart} onCheckedChange={setAutoStart} />
            Auto-start daemon
          </label>
          <label
            htmlFor="co-authored-trailer"
            className="flex items-center gap-2.5 text-sm text-text-secondary"
          >
            <Switch id="co-authored-trailer" checked={coAuthored} onCheckedChange={setCoAuthored} />
            Co-authored-by trailer
          </label>
          <label
            htmlFor="reviewed"
            className="flex items-center gap-2.5 text-sm text-text-secondary"
          >
            <Checkbox
              id="reviewed"
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(v === true)}
            />
            Reviewed
          </label>
        </div>
      </div>
    </Section>
  );
}
