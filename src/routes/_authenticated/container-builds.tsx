import { createFileRoute } from "@tanstack/react-router";
import { Container } from "lucide-react";
import { SpecialtyList } from "@/components/specialty-list";
import { CONTAINER_TYPES } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/container-builds")({
  component: () => <SpecialtyList title="Container Build Pro" subtitle="Shipping container Airbnbs, homes, game rooms, theaters." icon={Container} allowedTypes={CONTAINER_TYPES} />,
});
