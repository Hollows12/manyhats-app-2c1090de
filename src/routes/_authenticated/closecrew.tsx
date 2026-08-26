import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PhoneCall, MessageSquareText, UserRoundCheck, FileCheck2, BadgeDollarSign, Star, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/closecrew")({ component: CloseCrewPage });

type Metric = { label: string; value: string; note: string; icon: typeof PhoneCall };

function CloseCrewPage() {
  const workspace = useQuery({
    queryKey: ["closecrew", "workspace"],
    queryFn: async () => {
      const client = supabase as any;
      const membership = await client.from("organization_memberships").select("organization_id,organizations(name)").eq("active", true).limit(1).maybeSingle();
      if (membership.error || !membership.data) return { available: false as const, reason: "CloseCrew is not configured for this business." };
      const organizationId = membership.data.organization_id as string;
      const access = await client.rpc("closecrew_has_entitlement", { _organization_id: organizationId, _feature_key: "closecrew_core" });
      if (access.error || access.data !== true) return { available: false as const, reason: "CloseCrew is off until rollout, configuration, and subscription access are valid." };
      const [leads, messages, enrollments, reviews, revenue] = await Promise.all([
        client.from("closecrew_leads").select("id,state", { count: "exact" }).eq("organization_id", organizationId),
        client.from("closecrew_messages").select("id,status,direction", { count: "exact" }).eq("organization_id", organizationId),
        client.from("closecrew_enrollments").select("id,status", { count: "exact" }).eq("organization_id", organizationId),
        client.from("closecrew_review_requests").select("id,status", { count: "exact" }).eq("organization_id", organizationId),
        client.from("closecrew_revenue_attributions").select("amount,classification").eq("organization_id", organizationId),
      ]);
      const rows = revenue.data ?? [];
      const sum = (classification: string) => rows.filter((r: any) => r.classification === classification).reduce((total: number, r: any) => total + Number(r.amount), 0);
      return { available: true as const, organizationId, name: membership.data.organizations?.name ?? "Your business", leads: leads.data ?? [], messages: messages.data ?? [], enrollments: enrollments.data ?? [], reviews: reviews.data ?? [], attributed: sum("attributed"), estimated: sum("estimated"), confirmed: sum("confirmed") };
    },
  });

  if (workspace.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading CloseCrew…</div>;
  if (!workspace.data?.available) return <div className="space-y-6 p-6 md:p-8"><Header /><Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Securely off</AlertTitle><AlertDescription>{workspace.data?.reason ?? "Access could not be verified."}</AlertDescription></Alert></div>;

  const data = workspace.data;
  const metrics: Metric[] = [
    { label: "Qualified leads", value: String(data.leads.length), note: "Organization-scoped", icon: UserRoundCheck },
    { label: "Responses sent", value: String(data.messages.filter((m: any) => m.direction === "outbound" && ["sent","delivered"].includes(m.status)).length), note: "Sent or delivered", icon: MessageSquareText },
    { label: "Follow-ups", value: String(data.enrollments.filter((e: any) => e.status === "active").length), note: "Active with stop controls", icon: FileCheck2 },
    { label: "Reviews requested", value: String(data.reviews.filter((r: any) => ["sent","delivered"].includes(r.status)).length), note: "One per eligible job", icon: Star },
  ];

  return <div className="space-y-6 p-6 md:p-8"><Header business={data.name}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((m) => <Card key={m.label}><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{m.label}</CardTitle><m.icon className="h-4 w-4 text-gold"/></CardHeader><CardContent><div className="text-3xl font-bold">{m.value}</div><p className="text-xs text-muted-foreground">{m.note}</p></CardContent></Card>)}</div>
    <div className="grid gap-4 md:grid-cols-3"><RevenueCard title="Attributed" amount={data.attributed} note="CloseCrew was part of the recorded path; causation is not claimed."/><RevenueCard title="Estimated" amount={data.estimated} note="Open opportunity value; not collected revenue."/><RevenueCard title="Confirmed" amount={data.confirmed} note="Verified by job or payment evidence." emphasis/></div>
    <Tabs defaultValue="missed"><TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="missed">Missed calls</TabsTrigger><TabsTrigger value="leads">New leads</TabsTrigger><TabsTrigger value="followups">Follow-ups</TabsTrigger><TabsTrigger value="replies">Replies</TabsTrigger><TabsTrigger value="appointments">Appointments</TabsTrigger><TabsTrigger value="deposits">Deposits</TabsTrigger><TabsTrigger value="settings">Automation & consent</TabsTrigger><TabsTrigger value="usage">Usage</TabsTrigger></TabsList>{["missed","leads","followups","replies","appointments","deposits","settings","usage"].map((tab) => <TabsContent key={tab} value={tab}><Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{tab === "settings" ? "Templates, quiet hours, suppression, phone setup, and rollout prerequisites are controlled here." : "No records in this workspace yet."}</CardContent></Card></TabsContent>)}</Tabs>
  </div>;
}

function Header({ business }: { business?: string }) { return <div><div className="flex items-center gap-2"><PhoneCall className="h-7 w-7 text-gold"/><h1 className="font-display text-3xl font-bold">CloseCrew</h1></div><p className="mt-1 text-sm text-muted-foreground">{business ? `${business} · ` : ""}Recover missed opportunities with contractor-controlled, compliant follow-up.</p></div>; }
function RevenueCard({ title, amount, note, emphasis }: { title: string; amount: number; note: string; emphasis?: boolean }) { return <Card className={emphasis ? "border-gold/60" : ""}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><BadgeDollarSign className="h-4 w-4 text-gold"/>{title} recovered revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}</div><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>; }
