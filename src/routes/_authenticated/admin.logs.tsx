import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, AlertTriangle, ShieldAlert, ClipboardList, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth", search: {} });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: AdminLogsPage,
});

function AdminLogsPage() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/dashboard"><ArrowLeft className="mr-1 h-3 w-3" /> Dashboard</Link>
      </Button>

      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-gold" />
        <h1 className="font-display text-3xl font-bold">Admin Logs</h1>
        <Badge variant="outline">admin-only</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Full audit view of activity, errors, and immutable change history. Only admins can access this page.
      </p>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity"><Activity className="mr-1 h-3 w-3" /> Activity</TabsTrigger>
          <TabsTrigger value="errors"><AlertTriangle className="mr-1 h-3 w-3" /> Errors</TabsTrigger>
          <TabsTrigger value="audit"><ClipboardList className="mr-1 h-3 w-3" /> Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-4"><ActivityPanel /></TabsContent>
        <TabsContent value="errors" className="mt-4"><ErrorsPanel /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function ActivityPanel() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = (q.data ?? []).filter((r: any) =>
    !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Recent activity ({rows.length})</CardTitle>
        <Input placeholder="Filter…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
      </CardHeader>
      <CardContent>
        {q.isLoading ? <Loading /> : rows.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" description="Staff actions will show up here." />
        ) : (
          <div className="divide-y divide-border text-sm">
            {rows.map((r: any) => (
              <div key={r.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
                  {r.entity_type && <span className="text-xs text-muted-foreground">{r.entity_type}</span>}
                  {r.is_client_visible && <Badge className="bg-gold text-gold-foreground text-[10px]">client-visible</Badge>}
                  <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>
                {Object.keys(r.metadata ?? {}).length > 0 && (
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                    {JSON.stringify(r.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorsPanel() {
  const q = useQuery({
    queryKey: ["admin-errors"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Errors ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? <Loading /> : rows.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No errors captured" description="Nice — nothing to see here." />
        ) : (
          <div className="divide-y divide-border text-sm">
            {rows.map((r: any) => (
              <div key={r.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.level === "error" ? "destructive" : "outline"} className="text-[10px]">{r.level}</Badge>
                  <span className="truncate font-medium">{r.message}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>
                {r.route && <div className="text-[11px] text-muted-foreground">at {r.route}</div>}
                {r.stack && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px]">{r.stack}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditPanel() {
  const q = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_trails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Audit trail ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? <Loading /> : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No audit entries yet" description="Sensitive changes will be recorded here with before/after diffs." />
        ) : (
          <div className="divide-y divide-border text-sm">
            {rows.map((r: any) => (
              <div key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
                  <span className="text-xs font-medium">{r.entity_type}</span>
                  {r.reason && <span className="text-xs text-muted-foreground">— {r.reason}</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>
                <div className="mt-1 grid gap-2 md:grid-cols-2">
                  <DiffBox title="Before" value={r.before} />
                  <DiffBox title="After" value={r.after} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiffBox({ title, value }: { title: string; value: any }) {
  if (!value) return null;
  return (
    <div className="rounded border bg-muted/30 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <pre className="mt-1 max-h-40 overflow-auto text-[11px]">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function Loading() {
  return <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Loading…</div>;
}
