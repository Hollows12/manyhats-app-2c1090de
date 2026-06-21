import { PROJECT_STATUS_OPTIONS } from "@/lib/manyhats";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = PROJECT_STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        cfg?.color ?? "bg-slate-100 text-slate-700",
        className,
      )}
    >
      {cfg?.label ?? status}
    </span>
  );
}
