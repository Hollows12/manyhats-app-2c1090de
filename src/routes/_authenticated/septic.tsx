import { createFileRoute } from "@tanstack/react-router";
import { Droplets } from "lucide-react";
import { SpecialtyList } from "@/components/specialty-list";
import { SEPTIC_TYPES } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/septic")({
  component: () => <SpecialtyList title="Sentinel Septic Pro" subtitle="Septic installs, repairs, smart sensor monitoring." icon={Droplets} allowedTypes={SEPTIC_TYPES} />,
});
