import { cn } from "@/lib/utils";
import logoAsset from "@/assets/manyhats-logo.png.asset.json";

export function BrandMark({ className, hideTagline = false }: { className?: string; hideTagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoAsset.url}
        alt="ManyHats Pro shield logo"
        className="h-11 w-11 object-contain drop-shadow-[0_2px_8px_rgba(212,175,55,0.35)]"
      />
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
