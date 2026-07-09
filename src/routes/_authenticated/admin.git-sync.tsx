import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  GitBranch,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGitSyncStatus } from "@/lib/git-sync.functions";
import { formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/admin/git-sync")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: GitSyncPage,
});

function GitSyncPage() {
  const fetchStatus = useServerFn(getGitSyncStatus);
  const q = useQuery({
    queryKey: ["admin-git-sync"],
    queryFn: () => fetchStatus(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const s = q.data;
  const inSync =
    s?.configured && s.aheadBy === 0 && s.behindBy === 0 && !s.error;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/dashboard">
          <ArrowLeft className="mr-1 h-3 w-3" /> Dashboard
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="h-5 w-5 text-gold" />
        <h1 className="font-display text-3xl font-bold">Git Sync Status</h1>
        <Badge variant="outline">admin-only</Badge>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
        >
          {q.isFetching ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Live comparison between the deployed build and the latest commit on the
        tracked branch. Refreshes automatically every minute.
      </p>

      {q.isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
            Checking GitHub…
          </CardContent>
        </Card>
      ) : !s ? null : !s.configured ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Not configured
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{s.error}</p>
            <p>
              Add a <code className="rounded bg-muted px-1">GITHUB_REPO</code>{" "}
              secret (e.g. <code className="rounded bg-muted px-1">owner/name</code>).
              Optional:{" "}
              <code className="rounded bg-muted px-1">GITHUB_BRANCH</code>,{" "}
              <code className="rounded bg-muted px-1">GITHUB_TOKEN</code>,{" "}
              <code className="rounded bg-muted px-1">BUILD_COMMIT_SHA</code>.
            </p>
          </CardContent>
        </Card>
      ) : s.error ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
              {s.error}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                {inSync ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> In sync
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Out of sync
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Repository" value={s.repo} />
              <Row label="Branch" value={s.branch} />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <ArrowDown className="h-3 w-3 text-amber-500" />
                  <span className="font-mono text-lg font-semibold">
                    {s.behindBy ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">behind</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 text-sky-500" />
                  <span className="font-mono text-lg font-semibold">
                    {s.aheadBy ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">ahead</span>
                </div>
              </div>
              <Row
                label="Last checked"
                value={formatDate(s.checkedAt)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Latest commit on {s.branch}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label="SHA"
                value={
                  <span className="font-mono text-xs">
                    {s.latestSha?.slice(0, 10)}
                  </span>
                }
              />
              <Row label="Author" value={s.latestAuthor} />
              <Row
                label="Committed"
                value={s.latestCommitAt ? formatDate(s.latestCommitAt) : "—"}
              />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Message
                </div>
                <div className="mt-1 truncate">{s.latestMessage ?? "—"}</div>
              </div>
              <Row
                label="Deployed SHA"
                value={
                  s.deployedSha ? (
                    <span className="font-mono text-xs">
                      {s.deployedSha.slice(0, 10)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      unknown (set BUILD_COMMIT_SHA)
                    </span>
                  )
                }
              />
              {s.htmlUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={s.htmlUrl} target="_blank" rel="noreferrer">
                    View on GitHub <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
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
