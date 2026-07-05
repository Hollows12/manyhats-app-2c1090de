import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, MapPin, Package, Truck, RefreshCw, ExternalLink, Star, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  discoverSuppliersByZip,
  enrichMaterialFromUrl,
  listSuppliers,
  listMaterials,
  listFirecrawlJobs,
  getMyServiceArea,
  upsertServiceArea,
} from "@/lib/firecrawl/pricing.functions";
import { formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-gold" /> Smart Pricing Engine
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Pulls public supplier & material info via Firecrawl, caches it in your backend, and feeds Smart Pricing
            AI. All AI recommendations require your approval before reaching a client proposal.
          </p>
        </div>
      </header>

      <ServiceAreaCard />

      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers"><Truck className="h-4 w-4 mr-1" />Suppliers</TabsTrigger>
          <TabsTrigger value="materials"><Package className="h-4 w-4 mr-1" />Materials</TabsTrigger>
          <TabsTrigger value="jobs"><Clock className="h-4 w-4 mr-1" />Job Log</TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
        <TabsContent value="materials"><MaterialsTab /></TabsContent>
        <TabsContent value="jobs"><JobsTab /></TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground border-t pt-3">
        Firecrawl only accesses publicly available pages. All prices show source URL + retrieval date. Contractor
        judgment overrides every AI suggestion.
      </p>
    </div>
  );
}

function ServiceAreaCard() {
  const qc = useQueryClient();
  const get = useServerFn(getMyServiceArea);
  const save = useServerFn(upsertServiceArea);
  const q = useQuery({ queryKey: ["service-area"], queryFn: () => get() });
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(40);

  const mut = useMutation({
    mutationFn: (v: { zip: string; radius_mi: number }) => save({ data: { ...v, is_primary: true } }),
    onSuccess: () => { toast.success("Service area saved"); qc.invalidateQueries({ queryKey: ["service-area"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const current = q.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-gold" /> Service Area</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {current && (
          <div className="text-sm text-muted-foreground">
            Current: <span className="font-mono">{current.zip}</span> / {current.radius_mi} mi radius
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">ZIP</Label>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder={current?.zip ?? "43055"} className="w-32" />
          </div>
          <div>
            <Label className="text-xs">Radius (mi)</Label>
            <Input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-28" />
          </div>
          <Button onClick={() => mut.mutate({ zip, radius_mi: radius })} disabled={!zip || mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const CATEGORIES = [
  "lumber", "concrete", "ready-mix concrete", "gravel", "asphalt",
  "plumbing supply", "electrical supply", "roofing supply", "masonry supply",
  "septic supply", "excavation supply", "hardware store", "home improvement",
];

function SuppliersTab() {
  const qc = useQueryClient();
  const list = useServerFn(listSuppliers);
  const discover = useServerFn(discoverSuppliersByZip);
  const areaFn = useServerFn(getMyServiceArea);

  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => list() });
  const area = useQuery({ queryKey: ["service-area"], queryFn: () => areaFn() });

  const [category, setCategory] = useState(CATEGORIES[0]);

  const mut = useMutation({
    mutationFn: (v: { zip: string; category: string }) => discover({ data: { ...v, limit: 10 } }),
    onSuccess: (r) => {
      toast.success(`Found ${r.found}, saved ${r.saved} suppliers`);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["firecrawl-jobs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Discovery failed"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="border rounded-md h-9 px-2 text-sm bg-transparent"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button
            disabled={!area.data?.zip || mut.isPending}
            onClick={() => area.data?.zip && mut.mutate({ zip: area.data.zip, category })}
          >
            {mut.isPending ? "Discovering…" : `Discover for ${area.data?.zip ?? "ZIP"}`}
          </Button>
          {!area.data?.zip && <span className="text-xs text-muted-foreground">Set a service-area ZIP first.</span>}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(suppliers.data ?? []).map((s: any) => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm">{s.name}</div>
                {s.is_favorite && <Star className="h-4 w-4 text-gold fill-gold" />}
              </div>
              <div className="flex flex-wrap gap-1">
                {(s.categories ?? []).map((c: string) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
              </div>
              {s.website && (
                <a href={s.website} target="_blank" rel="noreferrer" className="text-xs text-navy underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> {new URL(s.website).hostname}
                </a>
              )}
              <div className="text-[10px] text-muted-foreground">Updated {formatDate(s.last_updated)}</div>
            </CardContent>
          </Card>
        ))}
        {(suppliers.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No suppliers yet. Discover some for your ZIP.
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listMaterials);
  const enrich = useServerFn(enrichMaterialFromUrl);
  const materials = useQuery({ queryKey: ["materials"], queryFn: () => list() });
  const [url, setUrl] = useState("");

  const mut = useMutation({
    mutationFn: (u: string) => enrich({ data: { url: u } }),
    onSuccess: () => {
      toast.success("Material imported");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["firecrawl-jobs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-64">
            <Label className="text-xs">Public product URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <Button onClick={() => mut.mutate(url)} disabled={!url || mut.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${mut.isPending ? "animate-spin" : ""}`} />
            {mut.isPending ? "Fetching…" : "Import material"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(materials.data ?? []).map((m: any) => (
          <Card key={m.id}>
            <CardContent className="p-4 space-y-1">
              <div className="font-semibold text-sm">{m.name}</div>
              {m.manufacturer && <div className="text-xs text-muted-foreground">{m.manufacturer}</div>}
              {m.coverage && <div className="text-xs">Coverage: {m.coverage}</div>}
              {m.source_url && (
                <a href={m.source_url} target="_blank" rel="noreferrer" className="text-xs text-navy underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> source
                </a>
              )}
              <div className="text-[10px] text-muted-foreground">Added {formatDate(m.created_at)}</div>
            </CardContent>
          </Card>
        ))}
        {(materials.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No materials yet. Paste a public product URL to import.
          </div>
        )}
      </div>
    </div>
  );
}

function JobsTab() {
  const list = useServerFn(listFirecrawlJobs);
  const jobs = useQuery({ queryKey: ["firecrawl-jobs"], queryFn: () => list() });
  return (
    <div className="space-y-2">
      {(jobs.data ?? []).map((j: any) => (
        <Card key={j.id}>
          <CardContent className="p-3 flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              {j.status === "succeeded" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {j.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
              {(j.status === "running" || j.status === "queued") && <Clock className="h-4 w-4 text-muted-foreground" />}
              <div className="min-w-0">
                <div className="text-xs font-mono truncate">{j.kind} · {j.target}</div>
                {j.error && <div className="text-[10px] text-destructive truncate">{j.error}</div>}
                {j.result_summary && <div className="text-[10px] text-muted-foreground truncate">{JSON.stringify(j.result_summary)}</div>}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground shrink-0">{formatDate(j.created_at)}</div>
          </CardContent>
        </Card>
      ))}
      {(jobs.data ?? []).length === 0 && (
        <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          No Firecrawl jobs yet.
        </div>
      )}
    </div>
  );
}
