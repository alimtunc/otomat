import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";

export function FilesTabs() {
  const { changes } = useSearch({ strict: false });
  const navigate = useNavigate();
  return (
    <SegmentedControl
      type="single"
      value={changes ? "changes" : "files"}
      aria-label="File workspace"
      onValueChange={(value) => {
        if (value === null) return;
        void navigate({
          to: ".",
          search: (previous) => ({ ...previous, changes: value === "changes" || undefined }),
          replace: true,
          resetScroll: false,
        });
      }}
    >
      <SegmentedItem value="files" icon={<Icon name="folder" aria-hidden />}>
        Files
      </SegmentedItem>
      <SegmentedItem value="changes" icon={<Icon name="git-compare" aria-hidden />}>
        Changes
      </SegmentedItem>
    </SegmentedControl>
  );
}
