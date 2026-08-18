import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Building2, Save, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Role = "admin" | "crew" | "client";
type CompanySettings = {
  id: string;
  legal_name: string;
  owner_name: string;
  owner_title: string;
  phone: string;
  email: string | null;
  website: string | null;
  tagline: string;
  specialties: string;
  primary_color: string;
  accent_color: string;
  proposal_theme: "professional" | "modern" | "classic";
  default_terms: string | null;
  default_warranty: string | null;
};

const BRAND_DEFAULTS = {
  primary_color: "#0B1F3A",
  accent_color: "#C9A227",
} as const;

function SettingsPage() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["users-roles"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("user_id, role");
      if (rolesError) throw rolesError;
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, company");
      if (profilesError) throw profilesError;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return (profiles ?? []).map((profile: any) => ({
        ...profile,
        roles: (roles ?? []).filter((role: any) => role.user_id === profile.id).map((role: any) => role.role),
        isCurrentUser: profile.id === user?.id,
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
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update role"),
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-gold" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Company defaults, proposal branding, and secure team access.</p>
      </div>

      <CompanySettingsCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            Users and roles
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {users.isLoading && <div className="py-6 text-sm text-muted-foreground">Loading users…</div>}
          {users.error && <div className="py-6 text-sm text-destructive">Could not load users.</div>}
          {(users.data ?? []).map((user: any) => (
            <div key={user.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="font-semibold text-sm">{user.full_name ?? "—"}</div>
                {user.phone && <div className="text-xs text-muted-foreground">{user.phone}</div>}
              </div>
              <div className="flex items-center gap-2">
                {user.isCurrentUser && <Badge variant="outline">You</Badge>}
                <Select
                  value={(user.roles[0] ?? "crew") as Role}
                  onValueChange={(role) => setRole.mutate({ userId: user.id, role: role as Role })}
                  disabled={setRole.isPending && setRole.variables?.userId === user.id}
                >
                  <SelectTrigger className="w-32" aria-label={`Role for ${user.full_name ?? "user"}`}>
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

function CompanySettingsCard() {
  const qc = useQueryClient();
  const company = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_settings")
        .select("*")
        .eq("settings_key", "primary")
        .single();
      if (error) throw error;
      return data as CompanySettings;
    },
  });
  const [form, setForm] = useState<Omit<CompanySettings, "id"> | null>(null);

  useEffect(() => {
    if (company.data) {
      const { id: _id, ...editable } = company.data;
      setForm(editable);
    }
  }, [company.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!company.data || !form) throw new Error("Company settings are not ready");
      const payload = {
        owner_title: form.owner_title.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || null,
        website: form.website?.trim() || null,
        tagline: form.tagline.trim(),
        specialties: form.specialties.trim(),
        primary_color: form.primary_color.toUpperCase(),
        accent_color: form.accent_color.toUpperCase(),
        proposal_theme: form.proposal_theme,
        default_terms: form.default_terms?.trim() || null,
        default_warranty: form.default_warranty?.trim() || null,
      };
      const { error } = await (supabase as any).from("company_settings").update(payload).eq("id", company.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company settings saved.");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save company settings"),
  });

  if (company.error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">Could not load company settings.</CardContent>
      </Card>
    );
  }
  if (company.isLoading || !form) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Loading company settings…</CardContent>
      </Card>
    );
  }

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gold" />
          Company and proposal defaults
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="Legal company name" value={COMPANY.name} />
          <ReadOnlyField label="Owner" value={`${COMPANY.owner} · ${form.owner_title}`} />
        </div>
        <p className="text-xs text-muted-foreground">
          The ManyHats Construction legal identity and owner name are locked. Operational contact information and
          proposal presentation can be updated by an administrator.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Owner title" value={form.owner_title} onChange={(value) => update("owner_title", value)} />
          <TextField label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
          <TextField label="Email" value={form.email ?? ""} onChange={(value) => update("email", value)} type="email" />
          <TextField label="Website" value={form.website ?? ""} onChange={(value) => update("website", value)} />
          <TextField label="Tagline" value={form.tagline} onChange={(value) => update("tagline", value)} />
          <div className="space-y-1">
            <Label className="text-xs">Proposal style</Label>
            <Select value={form.proposal_theme} onValueChange={(value) => update("proposal_theme", value as CompanySettings["proposal_theme"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Specialties</Label>
          <Textarea value={form.specialties} onChange={(event) => update("specialties", event.target.value)} rows={2} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ColorField label="Primary navy" value={form.primary_color} onChange={(value) => update("primary_color", value)} />
          <ColorField label="Accent gold" value={form.accent_color} onChange={(value) => update("accent_color", value)} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            update("primary_color", BRAND_DEFAULTS.primary_color);
            update("accent_color", BRAND_DEFAULTS.accent_color);
          }}
        >
          Restore navy and gold
        </Button>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Default proposal terms</Label>
            <Textarea value={form.default_terms ?? ""} onChange={(event) => update("default_terms", event.target.value)} rows={4} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default warranty</Label>
            <Textarea value={form.default_warranty ?? ""} onChange={(event) => update("default_warranty", event.target.value)} rows={4} />
          </div>
        </div>

        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? "Saving…" : "Save company settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 p-1"
          aria-label={label}
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} pattern="^#[0-9A-Fa-f]{6}$" />
      </div>
    </div>
  );
}
