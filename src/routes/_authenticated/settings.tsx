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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
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
        roles: (roles ?? [])
          .filter((role: any) => role.user_id === profile.id)
          .map((role: any) => role.role),
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
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update role"),
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-gold" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Company defaults, proposal branding, and secure team access.
        </p>
      </div>

      <CompanySettingsCard />

      <OperatingDefaultsCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            Users and roles
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {users.isLoading && (
            <div className="py-6 text-sm text-muted-foreground">Loading users…</div>
          )}
          {users.error && (
            <div className="py-6 text-sm text-destructive">Could not load users.</div>
          )}
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
                  <SelectTrigger
                    className="w-32"
                    aria-label={`Role for ${user.full_name ?? "user"}`}
                  >
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
      const { error } = await (supabase as any)
        .from("company_settings")
        .update(payload)
        .eq("id", company.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company settings saved.");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save company settings"),
  });

  if (company.error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          Could not load company settings.
        </CardContent>
      </Card>
    );
  }
  if (company.isLoading || !form) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading company settings…
        </CardContent>
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
          The ManyHats Construction legal identity and owner name are locked. Operational contact
          information and proposal presentation can be updated by an administrator.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Owner title"
            value={form.owner_title}
            onChange={(value) => update("owner_title", value)}
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(value) => update("phone", value)}
          />
          <TextField
            label="Email"
            value={form.email ?? ""}
            onChange={(value) => update("email", value)}
            type="email"
          />
          <TextField
            label="Website"
            value={form.website ?? ""}
            onChange={(value) => update("website", value)}
          />
          <TextField
            label="Tagline"
            value={form.tagline}
            onChange={(value) => update("tagline", value)}
          />
          <div className="space-y-1">
            <Label className="text-xs">Proposal style</Label>
            <Select
              value={form.proposal_theme}
              onValueChange={(value) =>
                update("proposal_theme", value as CompanySettings["proposal_theme"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
          <Textarea
            value={form.specialties}
            onChange={(event) => update("specialties", event.target.value)}
            rows={2}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ColorField
            label="Primary navy"
            value={form.primary_color}
            onChange={(value) => update("primary_color", value)}
          />
          <ColorField
            label="Accent gold"
            value={form.accent_color}
            onChange={(value) => update("accent_color", value)}
          />
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
            <Textarea
              value={form.default_terms ?? ""}
              onChange={(event) => update("default_terms", event.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default warranty</Label>
            <Textarea
              value={form.default_warranty ?? ""}
              onChange={(event) => update("default_warranty", event.target.value)}
              rows={4}
            />
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

type OperatingDefaultKey =
  | "labor_cost_rate"
  | "labor_burden_pct"
  | "crew_size"
  | "equipment_cost_per_hour"
  | "travel_cost_per_mile"
  | "disposal_cost_per_load"
  | "permit_allowance"
  | "overhead_pct"
  | "contingency_pct"
  | "target_margin_pct"
  | "veteran_discount_pct";

type OperatingDefaultsRow = {
  id: string;
  settings_key: "primary";
  confirmed_fields: OperatingDefaultKey[];
} & Record<OperatingDefaultKey, number | null>;

const OPERATING_DEFAULT_FIELDS: Array<{
  key: OperatingDefaultKey;
  label: string;
  suffix?: string;
  min: number;
  max?: number;
  step?: number;
}> = [
  { key: "labor_cost_rate", label: "Base labor cost", suffix: "$ / hour", min: 0, step: 0.01 },
  { key: "labor_burden_pct", label: "Labor burden", suffix: "%", min: 0, max: 200, step: 0.1 },
  { key: "crew_size", label: "Typical crew size", suffix: "people", min: 1, max: 500, step: 1 },
  {
    key: "equipment_cost_per_hour",
    label: "Equipment cost",
    suffix: "$ / hour",
    min: 0,
    step: 0.01,
  },
  { key: "travel_cost_per_mile", label: "Travel cost", suffix: "$ / mile", min: 0, step: 0.01 },
  { key: "disposal_cost_per_load", label: "Disposal cost", suffix: "$ / load", min: 0, step: 0.01 },
  {
    key: "permit_allowance",
    label: "Typical permit allowance",
    suffix: "$ / job",
    min: 0,
    step: 0.01,
  },
  { key: "overhead_pct", label: "Company overhead", suffix: "%", min: 0, max: 100, step: 0.1 },
  { key: "contingency_pct", label: "Contingency", suffix: "%", min: 0, max: 100, step: 0.1 },
  {
    key: "target_margin_pct",
    label: "Target gross margin",
    suffix: "%",
    min: 0,
    max: 95,
    step: 0.1,
  },
  {
    key: "veteran_discount_pct",
    label: "Veteran discount",
    suffix: "%",
    min: 0,
    max: 100,
    step: 0.1,
  },
];

function OperatingDefaultsCard() {
  const qc = useQueryClient();
  const defaults = useQuery({
    queryKey: ["company-operating-defaults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_operating_defaults")
        .select("*")
        .eq("settings_key", "primary")
        .single();
      if (error) throw error;
      return data as OperatingDefaultsRow;
    },
  });
  const history = useQuery({
    queryKey: ["company-operating-defaults-history", defaults.data?.id],
    enabled: !!defaults.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_operating_defaults_history")
        .select("id, operation, changed_at, before_values, after_values")
        .eq("settings_id", defaults.data!.id)
        .order("changed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [form, setForm] = useState<OperatingDefaultsRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (defaults.data) setForm(defaults.data);
  }, [defaults.data]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (active) setIsAdmin(!!data);
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      if (!defaults.data || !form) throw new Error("Company defaults are not ready");
      const values = Object.fromEntries(
        OPERATING_DEFAULT_FIELDS.map(({ key }) => [
          key,
          form[key] === null || !Number.isFinite(Number(form[key])) ? null : Number(form[key]),
        ]),
      );
      const confirmed_fields = form.confirmed_fields.filter((key) => values[key] !== null);
      const { error } = await supabase
        .from("company_operating_defaults")
        .update({ ...values, confirmed_fields })
        .eq("id", defaults.data.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Operating defaults saved and recorded in history.");
      qc.invalidateQueries({ queryKey: ["company-operating-defaults"] });
      qc.invalidateQueries({ queryKey: ["company-operating-defaults-history"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save operating defaults"),
  });

  if (defaults.error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          Could not load operating defaults. Apply the database migration before using this section.
        </CardContent>
      </Card>
    );
  }
  if (defaults.isLoading || !form) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading operating defaults…
        </CardContent>
      </Card>
    );
  }

  const updateValue = (key: OperatingDefaultKey, value: string) => {
    setForm((current) =>
      current
        ? {
            ...current,
            [key]: value === "" ? null : Number(value),
            confirmed_fields: current.confirmed_fields.filter((item) => item !== key),
          }
        : current,
    );
  };
  const toggleConfirmed = (key: OperatingDefaultKey, confirmed: boolean) => {
    setForm((current) =>
      current
        ? {
            ...current,
            confirmed_fields: confirmed
              ? [...new Set([...current.confirmed_fields, key])]
              : current.confirmed_fields.filter((item) => item !== key),
          }
        : current,
    );
  };
  const confirmedCount = form.confirmed_fields.filter((key) => form[key] !== null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gold" />
          Operating defaults for pricing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Enter your company’s real operating numbers. Values stay marked as examples until an
          administrator confirms each one. Unconfirmed values trigger a warning on saved quote
          pricing.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {OPERATING_DEFAULT_FIELDS.map(({ key, label, suffix, min, max, step }) => {
            const hasValue = form[key] !== null;
            const confirmed = hasValue && form.confirmed_fields.includes(key);
            return (
              <div key={key} className="space-y-1 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`operating-${key}`} className="text-xs">
                    {label}
                  </Label>
                  <Badge variant={confirmed ? "default" : "outline"}>
                    {confirmed ? "Confirmed" : hasValue ? "Example · confirm" : "Not set"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`operating-${key}`}
                    type="number"
                    inputMode="decimal"
                    min={min}
                    max={max}
                    step={step}
                    value={form[key] ?? ""}
                    onChange={(event) => updateValue(key, event.target.value)}
                    disabled={!isAdmin}
                    placeholder="Enter company value"
                  />
                  {suffix && (
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {suffix}
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={!isAdmin || !hasValue}
                    onChange={(event) => toggleConfirmed(key, event.target.checked)}
                  />
                  This is a confirmed company value
                </label>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {confirmedCount} of {OPERATING_DEFAULT_FIELDS.length} values confirmed
          </div>
          {isAdmin ? (
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Saving…" : "Save operating defaults"}
            </Button>
          ) : (
            <Badge variant="outline">Admin access required to edit</Badge>
          )}
        </div>
        <div className="border-t pt-3">
          <div className="mb-2 text-xs font-semibold">Recent changes</div>
          {history.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading history…</div>
          ) : null}
          {(history.data ?? []).length === 0 && !history.isLoading ? (
            <div className="text-xs text-muted-foreground">No changes recorded yet.</div>
          ) : (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {(history.data ?? []).map((entry) => {
                const beforeValues = (entry.before_values ?? {}) as Record<string, unknown>;
                const afterValues = entry.after_values as Record<string, unknown>;
                const beforeConfirmed = Array.isArray(beforeValues.confirmed_fields)
                  ? (beforeValues.confirmed_fields as string[])
                  : [];
                const afterConfirmed = Array.isArray(afterValues.confirmed_fields)
                  ? (afterValues.confirmed_fields as string[])
                  : [];
                const changedFields = OPERATING_DEFAULT_FIELDS.filter(
                  ({ key }) =>
                    beforeValues[key] !== afterValues[key] ||
                    beforeConfirmed.includes(key) !== afterConfirmed.includes(key),
                );
                return (
                  <li key={entry.id}>
                    <div>
                      {entry.operation === "insert" ? "Defaults initialized" : "Defaults updated"} ·{" "}
                      {new Date(entry.changed_at).toLocaleString()}
                    </div>
                    {changedFields.length > 0 && (
                      <ul className="ml-4 list-disc">
                        {changedFields.map(({ key, label, suffix }) => (
                          <li key={key}>
                            {label}
                            {beforeValues[key] !== afterValues[key] && (
                              <>
                                : {formatDefaultValue(beforeValues[key], suffix)} →{" "}
                                {formatDefaultValue(afterValues[key], suffix)}
                              </>
                            )}
                            {beforeConfirmed.includes(key) !== afterConfirmed.includes(key) && (
                              <>
                                {" "}
                                ·{" "}
                                {afterConfirmed.includes(key)
                                  ? "marked confirmed"
                                  : "confirmation removed"}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDefaultValue(value: unknown, suffix?: string) {
  if (value === null || value === undefined) return "Not set";
  return suffix ? `${value} ${suffix}` : String(value);
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
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
    </div>
  );
}
