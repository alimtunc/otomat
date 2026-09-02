import { Button, Icon, type ButtonProps } from "@otomat/ui";

export function SubmitReviewButton(props: Omit<ButtonProps, "children">) {
  return (
    <Button size="sm" variant="primary" {...props}>
      <Icon name="git-pull-request" aria-hidden />
      Submit review
    </Button>
  );
}
