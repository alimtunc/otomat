import { Toaster } from "@otomat/ui";
import { Layers } from "lucide-react";

import { AvatarsSection } from "./sections/avatars";
import { ButtonsSection } from "./sections/buttons";
import { CardsSection } from "./sections/cards";
import { DropdownsSection } from "./sections/dropdowns";
import { InputsSection } from "./sections/inputs";
import { ProvenanceSection } from "./sections/provenance";
import { StatusChipsSection } from "./sections/status-chips";
import { SurfacesSection } from "./sections/surfaces";
import { TabsSection } from "./sections/tabs";
import { Switcher } from "./switcher";

export function GalleryApp() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-275 px-6 pb-24">
        <Switcher />
        <div className="flex items-center gap-2 py-6">
          <Layers className="size-5 text-iris-text" />
          <h1 className="m-0 text-xl font-semibold">Design system</h1>
          <span className="ml-1.5 text-xs text-text-tertiary">
            shadcn/ui + Base UI · Otomat Iris · live @otomat/ui components
          </span>
        </div>

        <SurfacesSection />
        <ButtonsSection />
        <DropdownsSection />
        <StatusChipsSection />
        <ProvenanceSection />
        <InputsSection />
        <TabsSection />
        <AvatarsSection />
        <CardsSection />
      </div>
      <Toaster />
    </div>
  );
}
