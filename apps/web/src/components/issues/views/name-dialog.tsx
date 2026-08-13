import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  Input,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { fieldErrorProps, hasText, requiredTrimmed } from "@web/lib/form";

export interface ViewNameDialogProps {
  title: string;
  submitLabel: string;
  initialName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}

export function ViewNameDialog({
  title,
  submitLabel,
  initialName,
  open,
  onOpenChange,
  onSubmit,
}: ViewNameDialogProps) {
  const form = useForm({
    defaultValues: { name: initialName },
    onSubmit: ({ value }) => onSubmit(value.name.trim()),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label={title} className="max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form.Field name="name" validators={{ onChange: requiredTrimmed("Name the view.") }}>
              {(field) => (
                <Field {...fieldErrorProps(field.state.meta)}>
                  <FieldLabel>Name</FieldLabel>
                  <FieldControl>
                    <Input
                      autoFocus
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="My work in review"
                      aria-label="View name"
                    />
                  </FieldControl>
                </Field>
              )}
            </form.Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <form.Subscribe selector={(state) => hasText(state.values.name)}>
              {(filled) => (
                <Button size="sm" type="submit" disabled={!filled}>
                  {submitLabel}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
