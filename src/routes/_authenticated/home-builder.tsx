import { createFileRoute } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { SpecialtyList } from "@/components/specialty-list";
import { HOME_TYPES } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/home-builder")({
  component: () => <SpecialtyList title="Home Builder Pro" subtitle="Custom homes, additions, barndominiums, garages." icon={Home} allowedTypes={HOME_TYPES} />,
});
