import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className, hideTagline = false }: { className?: string; hideTagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex h-11 w-11 items-center justify-center rounded-md border border-gold/40 bg-gradient-to-br from-charcoal to-black shadow-gold-glow">
        <HardHat className="h-5 w-5 text-gold" strokeWidth={2.5} />
        <span className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-gold/20" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight text-foreground">
          ManyHats{" "}
          <span className="bg-gradient-to-b from-[oklch(0.88_0.16_90)] to-[oklch(0.68_0.13_80)] bg-clip-text text-transparent">
            Pro
          </span>
        </div>
        {!hideTagline && (
          <div className="text-[10px] uppercase tracking-[0.22em] text-gold/70">
            Veteran-Owned Contractor
          </div>
        )}
      </div>
    </div>
  );
}
