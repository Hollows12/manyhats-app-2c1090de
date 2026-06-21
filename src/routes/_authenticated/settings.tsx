import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMPANY } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const users = useQuery({
    queryKey: ["users-roles"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone, company");
      return (profiles ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      }));
    },
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-gold"/>Settings</h1>
        <p className="text-sm text-muted-foreground">Company info and user roles.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Company</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Field label="Company name" value={COMPANY.name} />
          <Field label="Owner" value={`${COMPANY.owner} · ${COMPANY.ownerTitle}`} />
          <Field label="Phone" value={COMPANY.phone} />
          <Field label="Brand" value={COMPANY.tagline} />
          <Field label="Specialties" value={COMPANY.specialties} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Users</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {(users.data ?? []).map((u: any) => (
            <div key={u.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-semibold text-sm">{u.full_name ?? "—"}</div>
                {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
              </div>
              <div className="flex gap-1">
                {u.roles.map((r: string) => <Badge key={r} variant={r === "admin" ? "default" : "outline"}>{r}</Badge>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
