import { Tabs, TabsList, TabsTrigger } from "@otomat/ui";
import type { SavedView } from "@web/lib/issue/saved-view";

export interface IssueViewTabsProps {
  views: SavedView[];
  activeId: string;
  dirty: boolean;
  onSelect: (id: string) => void;
}

export function IssueViewTabs({ views, activeId, dirty, onSelect }: IssueViewTabsProps) {
  return (
    <Tabs
      value={activeId}
      onValueChange={(value) => {
        if (typeof value === "string") onSelect(value);
      }}
      className="min-w-0"
    >
      <TabsList aria-label="Saved issue views" bordered={false} className="overflow-x-auto">
        {views.map((view) => (
          <TabsTrigger
            key={view.id}
            value={view.id}
            badge={
              dirty && view.id === activeId ? (
                <span
                  aria-label="Unsaved changes"
                  className="size-1.5 rounded-full bg-iris-solid"
                />
              ) : null
            }
          >
            {view.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
