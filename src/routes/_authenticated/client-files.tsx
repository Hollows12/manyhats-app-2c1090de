import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  FolderLock, Search, Eye, ExternalLink, ShieldOff, Clock, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/client-files")({
  component: ClientFilesPage,
});

type ShareRow = {
  id: string;
  token: string;
  project_id: string;
  recipient_email: string | null;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  include_internal_notes: boolean;
  pin_verified_at: string | null;
  created_at: string;
  projects: {
    id: string;
    name: string;
    client_id: string | null;
    clients: { name: string | null } | null;
  } | null;
};

type Status = "all" | "active" | "expired" | "revoked";

function statusOf(s: ShareRow): Exclude<Status, "all"> {
  if (s.revoked_at) return "revoked";
  if (new Date(s.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

function portalUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/portal/client-file/${token}`;
}

function ClientFilesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [projectId, setProjectId] = useState<string>("all");

  const shares = useQuery({
    queryKey: ["client-files-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_file_shares")
        .select(
          "id, token, project_id, recipient_email, expires_at, revoked_at, view_count, last_viewed_at, include_internal_notes, pin_verified_at, created_at, projects:project_id(id, name, client_id, clients:client_id(name))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShareRow[];
    },
  });

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    (shares.data ?? []).forEach((s) => {
      if (s.projects) map.set(s.projects.id, s.projects.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [shares.data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (shares.data ?? []).filter((s) => {
      if (status !== "all" && statusOf(s) !== status) return false;
      if (projectId !== "all" && s.project_id !== projectId) return false;
      if (term) {
        const hay = [
          s.projects?.name,
          s.projects?.clients?.name,
          s.recipient_email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [shares.data, q, status, projectId]);

  const counts = useMemo(() => {
    const all = shares.data ?? [];
    return {
      total: all.length,
      active: all.filter((s) => statusOf(s) === "active").length,
      expired: all.filter((s) => statusOf(s) === "expired").length,
      revoked: all.filter((s) => statusOf(s) === "revoked").length,
    };
  }, [shares.data]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <FolderLock className="h-5 w-5 text-gold" />
        <h1 className="font-display text-3xl font-bold">Client Files</h1>
        <Badge variant="outline">{counts.total} shares</Badge>
        <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-600">
            {counts.active} active
          </span>
          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-600">
            {counts.expired} expired
          </span>
          <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">
            {counts.revoked} revoked
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Every secure client-file share you've issued, across all projects.
        Manage individual shares from each project's Client File tab.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search project, client, or recipient email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {shares.isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
            Loading shares…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderLock}
          title={counts.total === 0 ? "No client files shared yet" : "No matches"}
          description={
            counts.total === 0
              ? "Create a secure share from any project's Client File tab."
              : "Adjust your search or filters."
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => {
            const st = statusOf(s);
            return (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      to="/projects/$id"
                      params={{ id: s.project_id }}
                      className="font-semibold hover:underline"
                    >
                      {s.projects?.name ?? "(project deleted)"}
                    </Link>
                    {s.projects?.clients?.name && (
                      <span className="text-muted-foreground">
                        · {s.projects.clients.name}
                      </span>
                    )}
                    <StatusBadge status={st} />
                    {s.include_internal_notes && (
                      <Badge variant="outline" className="text-[10px]">
                        + internal notes
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span>
                    Recipient:{" "}
                    <span className="text-foreground">
                      {s.recipient_email ?? "—"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {s.view_count} views
                    {s.last_viewed_at && (
                      <span className="text-muted-foreground/70">
                        · last {formatDate(s.last_viewed_at)}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {st === "expired" ? "Expired " : "Expires "}
                    {formatDate(s.expires_at)}
                  </span>
                  <span>Created {formatDate(s.created_at)}</span>
                  <div className="ml-auto flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={portalUrl(s.token)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open portal <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/projects/$id" params={{ id: s.project_id }}>
                        Manage
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Exclude<Status, "all"> }) {
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
