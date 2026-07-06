import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, AlertCircle, Loader2, Lock, FileText, Receipt, Camera, PenTool, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatMoney, formatDate } from "@/lib/manyhats";

type ClientFile = {
  project: { name: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; description?: string | null };
  client: { name: string; email?: string | null; phone?: string | null };
  photos: Array<{ id: string; storage_path: string; caption?: string | null; phase?: string | null; captured_at?: string | null }>;
  estimates: Array<{ id: string; grand_total: number; status: string; created_at: string }>;
  proposals: Array<{ id: string; proposal_number: string; status: string; sent_at?: string | null; approved_at?: string | null; scope_of_work?: string | null; warranty_length?: string | null; warranty_notes?: string | null; exclusions?: string | null; payment_terms?: string | null }>;
  invoices: Array<{ id: string; invoice_number: string; total: number; balance_due: number; status: string; invoice_date: string; due_date?: string | null }>;
  payments: Array<{ id: string; amount: number; payment_date: string; method?: string | null }>;
  change_orders: Array<{ id: string; description: string; amount: number; status: string; created_at: string }>;
  signatures: Array<{ id: string; signer_name: string; signed_at: string; proposal_id: string }>;
  share: { expires_at: string; view_count: number };
  error?: string;
};

const PIN_KEY = (t: string) => `cf_pin_${t}`;

export const Route = createFileRoute("/portal/client-file/$token")({
  head: () => ({
    meta: [
      { title: "Your project file — ManyHats" },
      { name: "description", content: "Secure client project file." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientFilePortal,
  errorComponent: ({ error }) => <PortalShell><Err title="Something went wrong" body={error.message} /></PortalShell>,
  notFoundComponent: () => <PortalShell><Err title="Not found" body="This link is invalid or has been revoked." /></PortalShell>,
});

function ClientFilePortal() {
  const { token } = Route.useParams();
  const [pin, setPin] = useState<string>(() => (typeof window !== "undefined" ? sessionStorage.getItem(PIN_KEY(token)) ?? "" : ""));
  const [verifiedPin, setVerifiedPin] = useState<string | null>(pin.length === 6 ? pin : null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const file = useQuery({
    enabled: !!verifiedPin,
    queryKey: ["client-file", token, verifiedPin],
    queryFn: async (): Promise<ClientFile> => {
      const { data, error } = await (supabase.rpc as any)("portal_get_client_file", { _token: token, _pin: verifiedPin });
      if (error) throw error;
      return data as ClientFile;
    },
  });

  const verify = useMutation({
    mutationFn: async (candidate: string) => {
      const { data, error } = await (supabase.rpc as any)("portal_verify_client_file_pin", { _token: token, _pin: candidate });
      if (error) throw error;
      return { candidate, res: data as any };
    },
    onSuccess: ({ candidate, res }) => {
      if (res?.ok) {
        sessionStorage.setItem(PIN_KEY(token), candidate);
        setVerifiedPin(candidate);
        setAttemptsLeft(null);
        setLockedUntil(null);
      } else if (res?.error === "locked") {
        setLockedUntil(res.until ?? null);
      } else if (res?.error === "wrong_pin") {
        setAttemptsLeft(res.attempts_left ?? null);
        setPin("");
      } else if (res?.error) {
        setAttemptsLeft(null);
      }
    },
  });

  useEffect(() => {
    if (pin.length === 6 && !verifiedPin && !verify.isPending && !lockedUntil) {
      verify.mutate(pin);
    }
  }, [pin, verifiedPin, verify, lockedUntil]);

  if (!verifiedPin) {
    return (
      <PortalShell>
        <Card className="mx-auto max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15">
              <Lock className="h-5 w-5 text-gold" />
            </div>
            <CardTitle className="font-display">Enter your 6-digit PIN</CardTitle>
            <p className="text-xs text-muted-foreground">The PIN was sent to you separately by ManyHats.</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              value={pin}
              onChange={setPin}
              disabled={verify.isPending || !!lockedUntil}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
            {verify.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {attemptsLeft !== null && attemptsLeft > 0 && (
              <p className="text-xs text-destructive">Incorrect PIN. {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left.</p>
            )}
            {lockedUntil && (
              <p className="text-xs text-destructive text-center">
                Too many attempts. Try again after {formatDate(lockedUntil)}.
              </p>
            )}
          </CardContent>
        </Card>
      </PortalShell>
    );
  }

  if (file.isLoading) {
    return <PortalShell><div className="py-16 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading your file…</div></PortalShell>;
  }

  if (file.data?.error || !file.data) {
    const err = file.data?.error ?? "unknown";
    return (
      <PortalShell>
        <Err
          title={err === "expired" ? "Link expired" : err === "revoked" ? "Access revoked" : "Unable to load"}
          body="Please contact ManyHats for a fresh link."
        />
      </PortalShell>
    );
  }

  const d = file.data;
  const totalInvoiced = d.invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalPaid = d.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = d.invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  return (
    <PortalShell>
      <header className="space-y-1">
        <Badge className="bg-gold text-gold-foreground">Client project file</Badge>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{d.project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[d.project.address, d.project.city, d.project.state, d.project.zip].filter(Boolean).join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">
          For {d.client.name} · Access expires {formatDate(d.share.expires_at)}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={DollarSign} label="Invoiced" value={formatMoney(totalInvoiced)} />
        <Stat icon={Receipt} label="Paid" value={formatMoney(totalPaid)} />
        <Stat icon={DollarSign} label="Balance due" value={formatMoney(balance)} accent={balance > 0} />
      </div>

      <Tabs defaultValue="proposals">
        <TabsList className="flex-wrap">
          <TabsTrigger value="proposals"><FileText className="mr-1 h-3 w-3" />Proposals</TabsTrigger>
          <TabsTrigger value="invoices"><Receipt className="mr-1 h-3 w-3" />Invoices</TabsTrigger>
          <TabsTrigger value="photos"><Camera className="mr-1 h-3 w-3" />Photos</TabsTrigger>
          <TabsTrigger value="signatures"><PenTool className="mr-1 h-3 w-3" />Signatures</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="mt-4 space-y-3">
          {d.proposals.length === 0 && <Empty label="No proposals shared yet." />}
          {d.proposals.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-display">Proposal {p.proposal_number}</CardTitle>
                <Badge variant="outline">{p.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.scope_of_work && <Section title="Scope of work" body={p.scope_of_work} />}
                {p.warranty_length && <div><span className="font-semibold">Warranty:</span> {p.warranty_length}{p.warranty_notes ? ` — ${p.warranty_notes}` : ""}</div>}
                {p.exclusions && <Section title="Exclusions" body={p.exclusions} />}
                {p.payment_terms && <Section title="Payment terms" body={p.payment_terms} />}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-3">
          {d.invoices.length === 0 && <Empty label="No invoices yet." />}
          {d.invoices.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold">Invoice {i.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">
                    Dated {formatDate(i.invoice_date)}{i.due_date ? ` · Due ${formatDate(i.due_date)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(Number(i.total))}</div>
                  <div className="text-xs text-muted-foreground">
                    Balance {formatMoney(Number(i.balance_due))}
                  </div>
                  <Badge variant="outline" className="mt-1 text-[10px]">{i.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          {d.photos.length === 0 ? (
            <Empty label="No photos shared yet." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {d.photos.map((p) => (
                <PhotoTile key={p.id} path={p.storage_path} caption={p.caption ?? p.phase ?? ""} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="signatures" className="mt-4 space-y-2">
          {d.signatures.length === 0 && <Empty label="No signatures on file." />}
          {d.signatures.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-semibold">{s.signer_name}</div>
                  <div className="text-xs text-muted-foreground">Signed {formatDate(s.signed_at)}</div>
                </div>
                <PenTool className="h-4 w-4 text-gold" />
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <footer className="pt-6 text-center text-[11px] text-muted-foreground">
        Secure client file · {d.share.view_count} view{d.share.view_count === 1 ? "" : "s"} · Do not share this link.
      </footer>
    </PortalShell>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-0.5 whitespace-pre-wrap">{body}</div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 ${accent ? "text-destructive" : "text-gold"}`} />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`text-lg font-semibold ${accent ? "text-destructive" : ""}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function PhotoTile({ path, caption }: { path: string; caption: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.storage.from("field-photos").createSignedUrl(path, 3600).then(({ data }) => {
      if (mounted && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { mounted = false; };
  }, [path]);
  return (
    <figure className="overflow-hidden rounded-md border bg-muted/30">
      {url ? (
        <img src={url} alt={caption} className="aspect-square w-full object-cover" />
      ) : (
        <div className="aspect-square w-full animate-pulse bg-muted" />
      )}
      {caption && (
        <figcaption className="truncate px-2 py-1 text-[10px] text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:py-12">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" />
          <span>Encrypted · PIN protected · ManyHats client portal</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Err({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}
