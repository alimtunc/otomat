import {
  Field,
  FieldControl,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  RepositoryPullRequestPublication,
  type RepositoryPullRequestPublicationProps,
} from "@web/components/source-control/repository/publication";

type Resettable = { reset: () => void };

export interface RepositoryPullRequestFormProps {
  repositoryId: string;
  branches: string[];
  defaultBranch: string;
  revision: string;
  publish: RepositoryPullRequestPublicationProps["publish"] & Resettable;
  generate: RepositoryPullRequestPublicationProps["generate"] & Resettable;
  onPublished: () => void;
}

export function RepositoryPullRequestForm({
  repositoryId,
  branches,
  defaultBranch,
  revision,
  publish,
  generate,
  onPublished,
}: RepositoryPullRequestFormProps) {
  const form = useForm({ defaultValues: { base_ref: defaultBranch } });
  const items = branches.map((branch) => ({ value: branch, label: branch }));
  const busy = publish.isPending || generate.isPending;
  return (
    <>
      <form.Field name="base_ref">
        {(field) => (
          <Field>
            <FieldLabel>Target branch</FieldLabel>
            <Select
              items={items}
              value={field.state.value}
              disabled={busy}
              onValueChange={(next) => {
                if (next === null || next === field.state.value) return;
                field.handleChange(next);
                publish.reset();
                generate.reset();
              }}
            >
              <FieldControl>
                <SelectTrigger aria-label="Target branch">
                  <SelectValue />
                </SelectTrigger>
              </FieldControl>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.base_ref}>
        {(baseRef) => (
          <RepositoryPullRequestPublication
            key={baseRef}
            repositoryId={repositoryId}
            baseRef={baseRef}
            revision={revision}
            publish={publish}
            generate={generate}
            onPublished={onPublished}
          />
        )}
      </form.Subscribe>
    </>
  );
}
