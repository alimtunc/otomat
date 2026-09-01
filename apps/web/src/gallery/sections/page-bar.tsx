import {
  Breadcrumbs,
  ConnectionStatusIndicator,
  Icon,
  IconButton,
  PageBar,
  RunStatusChip,
  SegmentedControl,
  SegmentedItem,
} from "@otomat/ui";

import { Section } from "../section";

export function PageBarSection() {
  return (
    <Section title="Page bar">
      <div className="overflow-hidden rounded-md border border-border-subtle">
        <PageBar
          leading={
            <>
              <IconButton label="Back" icon={<Icon name="arrow-left" aria-hidden />} />
              <Breadcrumbs
                items={[
                  { label: "Runs", href: "#" },
                  { label: "OTO-57 · Stream cockpit metrics", href: "#" },
                  { label: "Run", current: true },
                ]}
              />
              <RunStatusChip status="running" />
            </>
          }
          tabs={
            <SegmentedControl type="single" defaultValue="conversation" aria-label="View tabs">
              <SegmentedItem
                value="conversation"
                icon={<Icon name="list-tree" className="max-lg:hidden" />}
              >
                Conversation
              </SegmentedItem>
              <SegmentedItem
                value="diff"
                icon={<Icon name="git-compare" className="max-lg:hidden" />}
              >
                Diff
              </SegmentedItem>
            </SegmentedControl>
          }
          trailing={
            <>
              <IconButton label="Activity" icon={<Icon name="activity" aria-hidden />} />
              <ConnectionStatusIndicator state="online" />
            </>
          }
        />
      </div>
    </Section>
  );
}
