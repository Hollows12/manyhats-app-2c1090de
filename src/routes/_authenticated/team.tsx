import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Copy, Trash2, Mail, ShieldCheck, HardHat, Clock, Check, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Role = "admin" | "crew";
type Invite = {
  id: string;
  email: string;
  role: Role;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — ManyHats Pro" }] }),
  component: TeamPage,
});

function makeToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function TeamPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("crew");

  const invites = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id,email,role,token,expires_at,accepted_at,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) throw new Error("Email required");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("invitations").insert({
        email: trimmed,
        role,
        token: makeToken(),
        invited_by: user?.id ?? null,
      }).select("token").single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: (token) => {
      const link = `${window.location.origin}/auth?invite=${token}`;
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invitation created — link copied to clipboard.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create invite"),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation revoked.");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke"),
  });

  const pending = (invites.data ?? []).filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date());
  const past = (invites.data ?? []).filter((i) => i.accepted_at || new Date(i.expires_at) <= new Date());

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <UserPlus className="h-7 w-7 text-gold" /> Team invitations
        </h1>
        <p className="text-sm text-muted-foreground">
          Invite crew and admins by email. They set their own password — no sharing credentials.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Invite a team member</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
            onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          >
            <div className="space-y-1">
              <Label htmlFor="invite-email" className="text-xs">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="crew">Crew</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending} className="w-full md:w-auto">
                <Mail className="mr-2 h-4 w-4" /> Create invite
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            A shareable link is generated and copied to your clipboard. Invitations expire after 14 days.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pending invitations</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {invites.isLoading && <div className="py-6 text-sm text-muted-foreground">Loading…</div>}
          {!invites.isLoading && pending.length === 0 && (
            <div className="py-6 text-sm text-muted-foreground">No pending invitations.</div>
          )}
          {pending.map((inv) => (
            <InviteRow key={inv.id} inv={inv} onRevoke={() => revoke.mutate(inv.id)} />
          ))}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">History</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {past.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-semibold">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.accepted_at ? `Accepted ${new Date(inv.accepted_at).toLocaleDateString()}` : "Expired"}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {inv.accepted_at ? <Check className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
                  {inv.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InviteRow({ inv, onRevoke }: { inv: Invite; onRevoke: () => void }) {
  const link = `${window.location.origin}/auth?invite=${inv.token}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">
          {inv.role === "admin" ? <ShieldCheck className="h-4 w-4 text-gold" /> : <HardHat className="h-4 w-4 text-muted-foreground" />}
          {inv.email}
          <Badge variant={inv.role === "admin" ? "default" : "outline"} className="capitalize">{inv.role}</Badge>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          Expires {new Date(inv.expires_at).toLocaleDateString()} · {link}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => toast.success("Invite link copied."),
              () => toast.error("Could not copy link"),
            );
          }}
        >
          <Copy className="mr-1 h-3 w-3" /> Copy link
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onRevoke}>
          <Trash2 className="mr-1 h-3 w-3" /> Revoke
        </Button>
      </div>
    </div>
  );
}
