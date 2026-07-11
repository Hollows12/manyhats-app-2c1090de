import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Copy, ExternalLink, Eye, Clock, ShieldOff, ShieldCheck,
  KeyRound, RefreshCw, Loader2, Mail, FileText, User as UserIcon,
  Filter, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/manyhats";

function parseUA(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

export const Route = createFileRoute("/_authenticated/client-files/$shareId")({
  component: ShareDetailsPage,
});

type Share = {
  id: string;
  token: string;
  project_id: string;
  recipient_email: string | null;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  view_count: number;
  last_viewed_at: string | null;
  include_internal_notes: boolean;
  pin_verified_at: string | null;
  pin_attempts: number;
  pin_locked_until: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  projects: {
    id: string;
    name: string;
    client_id: string | null;
    clients: { name: string | null; email: string | null } | null;
  } | null;
};

type View = {
  id: string;
  viewed_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

function portalUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/portal/client-file/${token}`;
}

function statusOf(s: Share): "active" | "expired" | "revoked" {
  if (s.revoked_at) return "revoked";
  if (new Date(s.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Copy failed"),
  );
}

function ShareDetailsPage() {
  const { shareId } = Route.useParams();
  const qc = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ipQuery, setIpQuery] = useState("");
  const [uaQuery, setUaQuery] = useState("");
  const [platform, setPlatform] = useState<string>("all");


  const share = useQuery({
    queryKey: ["client-file-share", shareId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_file_shares")
        .select(
          "id, token, project_id, recipient_email, expires_at, revoked_at, revoked_by, view_count, last_viewed_at, include_internal_notes, pin_verified_at, pin_attempts, pin_locked_until, created_at, updated_at, created_by, projects:project_id(id, name, client_id, clients:client_id(name, email))",
        )
        .eq("id", shareId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Share;
    },
  });

  const views = useQuery({
    queryKey: ["client-file-share-views", shareId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_file_share_views")
        .select("id, viewed_at, ip_address, user_agent")
        .eq("share_id", shareId)
        .order("viewed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as View[];
    },
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "rotate_client_file_share_pin",
        { _share_id: shareId },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { pin: string };
    },
    onSuccess: (d) => {
      navigator.clipboard.writeText(d.pin).catch(() => {});
      toast.success(`New PIN: ${d.pin} (copied)`);
      qc.invalidateQueries({ queryKey: ["client-file-share", shareId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "revoke_client_file_share",
        { _share_id: shareId },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Share revoked");
      qc.invalidateQueries({ queryKey: ["client-file-share", shareId] });
      qc.invalidateQueries({ queryKey: ["client-files-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (share.isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading share…
      </div>
    );
  }
  if (!share.data) return null;
  const s = share.data;
  const st = statusOf(s);
  const url = portalUrl(s.token);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/client-files">
          <ArrowLeft className="mr-1 h-3 w-3" /> All client files
        </Link>
      </Button>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <h1 className="font-display text-2xl font-bold">
            {s.projects?.name ?? "(project deleted)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Client file share ·{" "}
            <Link
              to="/projects/$id"
              params={{ id: s.project_id }}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Open project
            </Link>
          </p>
        </div>
        <StatusBadge status={st} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-gold" /> Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              label="Client"
              value={
                s.projects?.clients?.name ? (
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="h-3 w-3 text-muted-foreground" />
                    {s.projects.clients.name}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Recipient"
              value={
                s.recipient_email ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {s.recipient_email}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row label="Created" value={formatDate(s.created_at)} />
            <Row
              label={st === "expired" ? "Expired" : "Expires"}
              value={formatDate(s.expires_at)}
            />
            <Row
              label="Internal notes"
              value={
                s.include_internal_notes ? (
                  <Badge variant="outline" className="text-[10px]">
                    Included
                  </Badge>
                ) : (
                  "Hidden"
                )
              }
            />
            <Row
              label="PIN status"
              value={
                s.pin_locked_until &&
                new Date(s.pin_locked_until).getTime() > Date.now() ? (
                  <span className="text-destructive">
                    Locked until {formatDate(s.pin_locked_until)}
                  </span>
                ) : s.pin_verified_at ? (
                  <span className="text-emerald-600">
                    Verified {formatDate(s.pin_verified_at)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not yet used</span>
                )
              }
            />
            <Row
              label="Failed attempts"
              value={String(s.pin_attempts ?? 0)}
            />
            {s.revoked_at && (
              <Row
                label="Revoked"
                value={
                  <span className="text-destructive">
                    {formatDate(s.revoked_at)}
                  </span>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-gold" /> Share link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Portal URL
              </div>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
                  {url}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(url, "Link")}
                  disabled={st !== "active"}
                >
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                disabled={st !== "active"}
              >
                <a href={url} target="_blank" rel="noreferrer">
                  Open portal <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rotate.mutate()}
                disabled={st !== "active" || rotate.isPending}
              >
                {rotate.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <KeyRound className="mr-1 h-3 w-3" />
                )}
                Rotate PIN
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("Revoke this share? The link will stop working.")) {
                    revoke.mutate();
                  }
                }}
                disabled={st === "revoked" || revoke.isPending}
              >
                {revoke.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ShieldOff className="mr-1 h-3 w-3" />
                )}
                Revoke
              </Button>
            </div>
            <div className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              Share the PIN with your client separately (text or call) — never
              in the same message as the link.
            </div>
          </CardContent>
        </Card>
      </div>

      <AccessHistoryCard
        views={views.data ?? []}
        loading={views.isLoading}
        totalViews={s.view_count}
        lastViewedAt={s.last_viewed_at}
        fromDate={fromDate}
        toDate={toDate}
        ipQuery={ipQuery}
        uaQuery={uaQuery}
        platform={platform}
        onFromDate={setFromDate}
        onToDate={setToDate}
        onIp={setIpQuery}
        onUa={setUaQuery}
        onPlatform={setPlatform}
      />
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "active" | "expired" | "revoked";
}) {
  if (status === "active")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">
        Active
      </Badge>
    );
  if (status === "expired")
    return (
      <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20">
        Expired
      </Badge>
    );
  return (
    <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">
      <ShieldOff className="mr-1 h-3 w-3" /> Revoked
    </Badge>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

type ViewRow = {
  id: string;
  viewed_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

function AccessHistoryCard({
  views, loading, totalViews, lastViewedAt,
  fromDate, toDate, ipQuery, uaQuery, platform,
  onFromDate, onToDate, onIp, onUa, onPlatform,
}: {
  views: ViewRow[];
  loading: boolean;
  totalViews: number;
  lastViewedAt: string | null;
  fromDate: string;
  toDate: string;
  ipQuery: string;
  uaQuery: string;
  platform: string;
  onFromDate: (v: string) => void;
  onToDate: (v: string) => void;
  onIp: (v: string) => void;
  onUa: (v: string) => void;
  onPlatform: (v: string) => void;
}) {
  const platforms = useMemo(() => {
    const set = new Set<string>();
    views.forEach((v) => set.add(parseUA(v.user_agent)));
    return Array.from(set).sort();
  }, [views]);

  const filtered = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() + 86_399_000 : null;
    const ip = ipQuery.trim().toLowerCase();
    const ua = uaQuery.trim().toLowerCase();
    return views.filter((v) => {
      const t = new Date(v.viewed_at).getTime();
      if (fromTs !== null && t < fromTs) return false;
      if (toTs !== null && t > toTs) return false;
      if (ip && !(v.ip_address ?? "").toLowerCase().includes(ip)) return false;
      if (ua && !(v.user_agent ?? "").toLowerCase().includes(ua)) return false;
      if (platform !== "all" && parseUA(v.user_agent) !== platform) return false;
      return true;
    });
  }, [views, fromDate, toDate, ipQuery, uaQuery, platform]);

  const hasFilters =
    !!fromDate || !!toDate || !!ipQuery || !!uaQuery || platform !== "all";

  function clearAll() {
    onFromDate(""); onToDate(""); onIp(""); onUa(""); onPlatform("all");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-gold" /> Access history
          <Badge variant="outline">
            {hasFilters ? `${filtered.length} of ${views.length}` : totalViews} views
          </Badge>
          {lastViewedAt && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> last {formatDate(lastViewedAt)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <label className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From</div>
            <Input type="date" value={fromDate} onChange={(e) => onFromDate(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To</div>
            <Input type="date" value={toDate} onChange={(e) => onToDate(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">IP contains</div>
            <Input placeholder="e.g. 192.168" value={ipQuery} onChange={(e) => onIp(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">User agent contains</div>
            <Input placeholder="e.g. Chrome, Safari" value={uaQuery} onChange={(e) => onUa(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Platform</div>
            <select
              value={platform}
              onChange={(e) => onPlatform(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={!hasFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
            Loading views…
          </div>
        ) : views.length === 0 ? (
          <EmptyState
            icon={Eye}
            title="No views yet"
            description="Client views will appear here after they open the portal."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No matching views"
            description="Adjust the filters above to see events."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2 pr-4">Platform</th>
                  <th className="py-2">User agent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(v.viewed_at)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{v.ip_address ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {parseUA(v.user_agent)}
                      </Badge>
                    </td>
                    <td
                      className="max-w-md truncate py-2 text-xs text-muted-foreground"
                      title={v.user_agent ?? undefined}
                    >
                      {v.user_agent ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
