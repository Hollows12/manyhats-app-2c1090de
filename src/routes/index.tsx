import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HardHat, ShieldCheck, Hammer } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/manyhats";
import bannerAsset from "@/assets/manyhats-banner.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ManyHats Pro — Contractor Operating System" },
      {
        name: "description",
        content:
          "Leads, estimates, proposals, field capture, and job intelligence for ManyHats Construction LLC.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-navy-gradient text-ivory">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <BrandMark className="[&_.text-muted-foreground]:text-gold/70 [&_.font-display]:text-white" />
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="text-ivory hover:bg-white/10 hover:text-ivory"
            >
              <Link to="/auth" search={{ invite: undefined }}>
                Sign in
              </Link>
            </Button>
            <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/auth" search={{ invite: undefined }}>
                Open dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <img
            src={bannerAsset.url}
            alt="ManyHats Pro — Built in the field. Built for builders."
            className="w-full rounded-lg border border-gold/20 shadow-gold-glow"
          />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-14 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
              <ShieldCheck className="h-3.5 w-3.5" /> {COMPANY.tagline}
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] md:text-6xl">
              The contractor command center for <span className="text-gold">{COMPANY.name}.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ivory/80">
              Leads. Clients. Field capture. Estimates. Proposals. Concepts. Job costing. Every
              project ties back to the same source of truth — built for{" "}
              {COMPANY.specialties.toLowerCase()}.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
                <Link to="/auth" search={{ invite: undefined }}>
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <a
                href={`tel:${COMPANY.phone.replace(/-/g, "")}`}
                className="inline-flex h-11 items-center justify-center rounded-md border border-ivory/30 px-6 text-sm font-semibold hover:bg-white/10"
              >
                Call {COMPANY.owner} · {COMPANY.phone}
              </a>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8 text-sm">
              <div>
                <dt className="text-gold/80 text-xs uppercase tracking-widest">Owner</dt>
                <dd className="mt-1 font-semibold">{COMPANY.owner}</dd>
                <dd className="text-xs text-ivory/60">{COMPANY.ownerTitle}</dd>
              </div>
              <div>
                <dt className="text-gold/80 text-xs uppercase tracking-widest">Phone</dt>
                <dd className="mt-1 font-semibold">{COMPANY.phone}</dd>
              </div>
              <div>
                <dt className="text-gold/80 text-xs uppercase tracking-widest">Specialties</dt>
                <dd className="mt-1 text-xs leading-relaxed">{COMPANY.specialties}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-4">
            {[
              {
                icon: HardHat,
                title: "Field-first",
                body: "Capture photos, measurements, and notes from a phone. No app required.",
              },
              {
                icon: Hammer,
                title: "From lead to closeout",
                body: "16 modules — leads, estimates, proposals, concepts, job costing, and a private knowledge base.",
              },
              {
                icon: ShieldCheck,
                title: "Protective by default",
                body: "No final pricing without confirmed measurements. Real photos always last in the proposal.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur"
              >
                <card.icon className="h-6 w-6 text-gold" />
                <h3 className="mt-3 font-display text-lg font-semibold">{card.title}</h3>
                <p className="mt-1 text-sm text-ivory/70">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-ivory/50">
        © {new Date().getFullYear()} {COMPANY.name} · {COMPANY.tagline}
      </footer>
    </div>
  );
}
