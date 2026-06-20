import {
  Badge,
  PillTabs,
  Pill,
  SegmentedControl,
  SegmentedItem,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@otomat/ui";
import { Columns3, List } from "lucide-react";

import { Section } from "../section";

export function TabsSection() {
  return (
    <Section title="Tabs · segmented · pills">
      <div className="flex flex-wrap items-start gap-6">
        <SegmentedControl type="single" defaultValue="board" aria-label="Layout">
          <SegmentedItem value="board" icon={<Columns3 />}>
            Board
          </SegmentedItem>
          <SegmentedItem value="list" icon={<List />}>
            List
          </SegmentedItem>
        </SegmentedControl>

        <PillTabs type="single" defaultValue="for-me" aria-label="Filter">
          <Pill value="for-me">For me</Pill>
          <Pill value="created">Created</Pill>
        </PillTabs>

        <Tabs defaultValue="activity">
          <TabsList bordered={false}>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="diff" badge={<Badge variant="iris">+124</Badge>}>
              Diff
            </TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </Section>
  );
}
