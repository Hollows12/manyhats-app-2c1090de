import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Copy,
  KeyRound,
  RefreshCw,
  ShieldOff,
  Eye,
  ExternalLink,
  Loader2,
  Link2,
  ShieldCheck,
  Clock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/manyhats";
import { sendPortalInvitationEmailFn } from "@/lib/email.functions";

type Share = {
  id: string;
  token: string;
  recipient_email: string | null;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  include_internal_notes: boolean;
  pin_verified_at: string | null;
  created_at: string;
};

function portalUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/portal/client-file/${token}`;
}

export function ClientFileTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("14");
  const [includeInternal, setIncludeInternal] = useState(false);
  const [issued, setIssued] = useState<{ token: string; pin: string } | null>(null);

  const list = useQuery({
    queryKey: ["client-file-shares", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_file_shares")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Share[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("create_client_file_share", {
        _project_id: projectId,
        _recipient_email: email || null,
        _expires_days: Number(days) || 14,
        _include_internal_notes: includeInternal,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { token: string; pin: string };
    },
    onSuccess: (d) => {
      setIssued({ token: d.token, pin: d.pin });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["client-file-shares", projectId] });
      toast.success("Client file link created. Share the PIN privately.");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create share"),
  });

  const rotate = useMutation({
    mutationFn: async (shareId: string) => {
      const { data, error } = await (supabase.rpc as any)("rotate_client_file_share_pin", {
        _share_id: shareId,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { pin: string };
    },
    onSuccess: (d) => {
      navigator.clipboard.writeText(d.pin).catch(() => {});
      toast.success(`New PIN: ${d.pin} (copied)`);
      qc.invalidateQueries({ queryKey: ["client-file-shares", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (shareId: string) => {
      const { data, error } = await (supabase.rpc as any)("revoke_client_file_share", {
        _share_id: shareId,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-file-shares", projectId] });
      toast.success("Share revoked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendEmail = useMutation({
    mutationFn: async (shareId: string) => {
      const result = await sendPortalInvitationEmailFn({ data: { share_id: shareId } });
      return result;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["client-file-shares", projectId] });
      toast.success(`Portal invitation sent to ${result.recipientEmail}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send email"),
  });

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <ShieldCheck className="h-4 w-4 text-gold" /> Create client file link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="cf-email" className="text-xs">
                Recipient email (optional, for your records)
              </Label>
              <Input
                id="cf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div>
              <Label htmlFor="cf-days" className="text-xs">
                Expires in (days)
              </Label>
              <Input
                id="cf-days"
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={includeInternal} onCheckedChange={(v) => setIncludeInternal(!!v)} />
            Include internal notes (staff-only fields — usually leave off for client)
          </label>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {create.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <KeyRound className="mr-1 h-3 w-3" />
            )}
            Generate secure link + PIN
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Link is scoped to this project only. Client must enter the 6-digit PIN to view. 5 wrong
            tries = 30-min lockout.
          </p>
        </CardContent>
      </Card>

      {issued && (
        <Card className="border-gold/60 bg-gold/5">
          <CardHeader>
            <CardTitle className="text-sm font-display">
              Share these with your client (shown once)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <Label className="text-xs">Portal link</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input readOnly value={portalUrl(issued.token)} className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(portalUrl(issued.token), "Link")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">One-time PIN</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input readOnly value={issued.pin} className="font-mono text-lg tracking-[0.4em]" />
                <Button size="sm" variant="outline" onClick={() => copy(issued.pin, "PIN")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Send the link and PIN through separate channels (link by email, PIN by SMS/phone). We
              never show the PIN again — rotate it below if lost.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Link2 className="h-4 w-4 text-gold" /> Active shares
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (list.data ?? []).length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No client shares yet"
              description="Generate a link above to give the client secure access to their job file."
            />
          ) : (
            <div className="divide-y divide-border">
              {list.data!.map((s) => {
                const expired = new Date(s.expires_at) < new Date();
                const status = s.revoked_at ? "revoked" : expired ? "expired" : "active";
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={status === "active" ? "default" : "outline"}
                          className={status === "active" ? "bg-gold text-gold-foreground" : ""}
                        >
                          {status}
                        </Badge>
                        {s.recipient_email && (
                          <span className="truncate text-sm font-medium">{s.recipient_email}</span>
                        )}
                        {s.pin_verified_at && (
                          <Badge variant="outline" className="text-[10px]">
                            PIN verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Expires {formatDate(s.expires_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {s.view_count} view
                          {s.view_count === 1 ? "" : "s"}
                        </span>
                        {s.last_viewed_at && (
                          <span>Last opened {formatDate(s.last_viewed_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy(portalUrl(s.token), "Link")}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copy link
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={portalUrl(s.token)} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" /> Open
                        </a>
                      </Button>
                      {status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rotate.mutate(s.id)}
                            disabled={rotate.isPending}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" /> New PIN
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendEmail.mutate(s.id)}
                            disabled={sendEmail.isPending && sendEmail.variables === s.id}
                            title={
                              s.recipient_email
                                ? `Send PIN to ${s.recipient_email}`
                                : "No recipient email — add one to the share"
                            }
                          >
                            {sendEmail.isPending && sendEmail.variables === s.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="mr-1 h-3 w-3" />
                            )}
                            Send PIN
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => revoke.mutate(s.id)}
                            disabled={revoke.isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            <ShieldOff className="mr-1 h-3 w-3" /> Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
