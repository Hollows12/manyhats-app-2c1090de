import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { SpecialtyList } from "@/components/specialty-list";
import { HISTORIC_TYPES } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/historic")({
  component: () => <SpecialtyList title="Historic Restoration Pro" subtitle="Museums, theaters, churches, downtown masonry restoration." icon={Landmark} allowedTypes={HISTORIC_TYPES} />,
});
