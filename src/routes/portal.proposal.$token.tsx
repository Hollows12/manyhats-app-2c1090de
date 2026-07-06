import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileText, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatDate } from "@/lib/manyhats";
import { INVOICE_STATUS_META } from "@/lib/finance";

type PortalPayload = {
  proposal: {
    id: string;
    proposal_number: string;
    status: string;
    executive_summary?: string | null;
    scope_of_work?: string | null;
    recommendation?: string | null;
    timeline?: string | null;
    warranty_length?: string | null;
    warranty_notes?: string | null;
    exclusions?: string | null;
    payment_terms?: string | null;
    sent_at?: string | null;
    approved_at?: string | null;
  };
  options: Array<{
    id: string; tier: string; title: string; description?: string | null;
    price: number; is_recommended: boolean; sort_order: number;
  }>;
  project: { name: string; address?: string | null; city_state_zip?: string | null };
  client_name?: string | null;
  invoices: Array<{
    id: string; invoice_number: string; invoice_date: string; due_date?: string | null;
    subtotal: number; tax: number; total: number; balance_due: number; status: string;
  }>;
  totals: { invoiced: number; outstanding: number };
  error?: string;
};

export const Route = createFileRoute("/portal/proposal/$token")({
  head: () => ({
    meta: [
      { title: "Proposal — Customer Portal" },
      { name: "description", content: "Review, sign, and track your proposal." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalProposalPage,
  errorComponent: ({ error }) => (
    <PortalShell>
      <ErrorBox title="Something went wrong" body={error.message} />
    </PortalShell>
  ),
  notFoundComponent: () => (
    <PortalShell>
      <ErrorBox title="Proposal not found" body="This link is invalid or has been revoked." />
    </PortalShell>
  ),
});

function PortalProposalPage() {
  const { token } = Route.useParams();
  const router = useRouter();

  const q = useQuery({
    queryKey: ["portal-proposal", token],
    queryFn: async (): Promise<PortalPayload> => {
      const { data, error } = await supabase.rpc("portal_get_proposal", { _token: token });
      if (error) throw error;
      return data as unknown as PortalPayload;
    },
  });

  if (q.isLoading) {
    return <PortalShell><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Loading proposal…</div></PortalShell>;
  }

  const payload = q.data;
  if (!payload || payload.error) {
    const map: Record<string, { title: string; body: string }> = {
      not_found: { title: "Proposal not found", body: "This link is invalid or has been revoked." },
      expired: { title: "Link expired", body: "Please contact your contractor for a fresh link." },
      invalid_token: { title: "Invalid link", body: "This URL is malformed." },
    };
    const m = map[payload?.error ?? ""] ?? { title: "Unavailable", body: "This proposal isn't available right now." };
    return <PortalShell><ErrorBox title={m.title} body={m.body} /></PortalShell>;
  }

  const { proposal, options, project, client_name, invoices, totals } = payload;
  const accepted = proposal.status === "approved";

  return (
    <PortalShell>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline"><FileText className="mr-1 h-3 w-3"/>{proposal.proposal_number}</Badge>
          <Badge variant={accepted ? "default" : "outline"} className="capitalize">{proposal.status}</Badge>
          {proposal.sent_at && <span>Sent {formatDate(proposal.sent_at)}</span>}
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">{project.name}</h1>
        {client_name && <p className="text-sm text-muted-foreground">Prepared for {client_name}</p>}
        {(project.address || project.city_state_zip) && (
          <p className="text-xs text-muted-foreground">{[project.address, project.city_state_zip].filter(Boolean).join(" · ")}</p>
        )}
      </header>

      {/* Proposal body */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Proposal</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Section title="Executive Summary" body={proposal.executive_summary} />
            <Section title="Scope of Work" body={proposal.scope_of_work} />
            <Section title="Recommendation" body={proposal.recommendation} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Timeline" body={proposal.timeline} />
              <Section title="Warranty" body={[proposal.warranty_length, proposal.warranty_notes].filter(Boolean).join(" — ")} />
            </div>
            <Section title="Exclusions" body={proposal.exclusions} />
            <Section title="Payment Terms" body={proposal.payment_terms} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Options</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {options.length === 0 && <p className="text-xs text-muted-foreground">No pricing options listed.</p>}
              {options.map((o) => (
                <div key={o.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{o.title}</div>
                    <div className="tabular-nums font-display text-lg">{formatMoney(Number(o.price))}</div>
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{o.tier}</div>
                  {o.description && <p className="text-xs text-muted-foreground mt-1">{o.description}</p>}
                  {o.is_recommended && <Badge className="mt-2" variant="secondary">Recommended</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Invoices & Balances</CardTitle>
            <div className="text-xs text-muted-foreground">
              Invoiced <span className="font-semibold text-foreground tabular-nums">{formatMoney(totals.invoiced)}</span>
              {" · "}Outstanding <span className={`font-semibold tabular-nums ${totals.outstanding > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatMoney(totals.outstanding)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {invoices.map((i) => {
                const meta = INVOICE_STATUS_META[i.status] ?? { label: i.status, color: "" };
                return (
                  <div key={i.id} className="grid grid-cols-12 items-center gap-2 px-4 py-2 text-sm">
                    <div className="col-span-4 font-mono text-xs">{i.invoice_number}</div>
                    <div className="col-span-3 text-xs text-muted-foreground">{formatDate(i.invoice_date)}{i.due_date ? ` · due ${formatDate(i.due_date)}` : ""}</div>
                    <div className="col-span-2 tabular-nums">{formatMoney(Number(i.total))}</div>
                    <div className={`col-span-2 tabular-nums ${Number(i.balance_due) > 0 ? "text-amber-700 font-semibold" : "text-emerald-700"}`}>{formatMoney(Number(i.balance_due))}</div>
                    <div className="col-span-1 text-right"><Badge variant="outline" className="text-[10px] capitalize">{meta.label}</Badge></div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accept */}
      {accepted ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5"/>
            Proposal accepted{proposal.approved_at ? ` on ${formatDate(proposal.approved_at)}` : ""}. Thank you!
          </CardContent>
        </Card>
      ) : (
        <AcceptForm token={token} options={options} onAccepted={() => router.invalidate()} />
      )}

      <p className="pt-4 text-center text-[11px] text-muted-foreground">
        <ShieldCheck className="inline h-3 w-3 mr-1"/> Secure link. Do not share this URL — anyone with it can view this proposal.
      </p>
    </PortalShell>
  );
}

function Section({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
      <div className="whitespace-pre-wrap leading-relaxed">{body}</div>
    </div>
  );
}

function AcceptForm({ token, options, onAccepted }: {
  token: string;
  options: PortalPayload["options"];
  onAccepted: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const recommendedId = useMemo(
    () => options.find((o) => o.is_recommended)?.id ?? options[0]?.id ?? null,
    [options],
  );
  const [selected, setSelected] = useState<string | null>(recommendedId);

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("portal_accept_proposal", {
        _token: token,
        _signer_name: name,
        _signer_email: email || (null as unknown as string),
        _selected_option_id: (selected ?? null) as unknown as string,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => { toast.success("Proposal accepted. Thank you!"); onAccepted(); },
    onError: (e: any) => toast.error(e.message ?? "Could not accept"),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Accept & Sign</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {options.length > 1 && (
          <div>
            <Label className="text-xs">Selected option</Label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {options.map((o) => (
                <button key={o.id} type="button" onClick={() => setSelected(o.id)}
                  className={`text-left rounded-md border p-2 transition ${selected === o.id ? "border-gold ring-1 ring-gold" : "hover:border-muted-foreground/40"}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{o.title}</span>
                    <span className="tabular-nums text-sm">{formatMoney(Number(o.price))}</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{o.tier}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Your full name (typed signature) *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div>
            <Label className="text-xs">Email (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          By typing your name and clicking Accept, you agree to the scope, pricing, and terms above. Your acceptance is legally binding and a copy is kept on file.
        </p>
        <Button className="w-full" disabled={accept.isPending || name.trim().length < 2}
          onClick={() => accept.mutate()}>
          {accept.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4"/>}
          Accept proposal
        </Button>
      </CardContent>
    </Card>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12 space-y-6">
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-2">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-600"/>
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}
