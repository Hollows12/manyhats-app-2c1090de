import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPANY } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Role = "admin" | "crew" | "client";

function SettingsPage() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["users-roles"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone, company");
      const { data: { user } } = await supabase.auth.getUser();
      return (profiles ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
        isCurrentUser: p.id === user?.id,
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await (supabase as any).rpc("set_user_role", {
        _target_user_id: userId,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User role updated.");
      qc.invalidateQueries({ queryKey: ["users-roles"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update role"),
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-gold"/>Settings</h1>
        <p className="text-sm text-muted-foreground">Company info and secure team access.</p>
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
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" />Users and roles</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {(users.data ?? []).map((u: any) => (
            <div key={u.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-semibold text-sm">{u.full_name ?? "—"}</div>
                {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
              </div>
              <div className="flex items-center gap-2">
                {u.isCurrentUser && <Badge variant="outline">You</Badge>}
                <Select
                  value={(u.roles[0] ?? "crew") as Role}
                  onValueChange={(role) => setRole.mutate({ userId: u.id, role: role as Role })}
                  disabled={setRole.isPending && setRole.variables?.userId === u.id}
                >
                  <SelectTrigger className="w-32" aria-label={`Role for ${u.full_name ?? "user"}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="crew">Crew</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
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
