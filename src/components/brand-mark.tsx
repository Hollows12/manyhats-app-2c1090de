import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className, hideTagline = false }: { className?: string; hideTagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold text-gold-foreground shadow-md">
        <HardHat className="h-5 w-5" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight">
          ManyHats <span className="text-gold">Pro</span>
        </div>
        {!hideTagline && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Veteran-Owned Contractor
          </div>
        )}
      </div>
    </div>
  );
}
