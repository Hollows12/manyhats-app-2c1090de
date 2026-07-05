import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchLiveSchema, type SchemaSnapshot } from "@/lib/schema-check/schema.functions";
import { diffSchemas, type SchemaDiffResult } from "@/lib/schema-check/diff";
import expectedSchemaJson from "@/lib/schema-check/expected-schema.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

const expectedSchema = expectedSchemaJson as SchemaSnapshot;

export const Route = createFileRoute("/_authenticated/schema-diff")({
  component: SchemaDiffPage,
  head: () => ({
    meta: [
      { title: "Schema diff — ManyHats" },
      { name: "description", content: "Compare live database schema to the expected snapshot." },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-lg font-semibold">Schema diff failed to load</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function SchemaDiffPage() {
  const fetchLive = useServerFn(fetchLiveSchema);
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["schema-diff"],
    queryFn: async () => {
      const live = await fetchLive();
      return diffSchemas(expectedSchema, live);
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Schema diff</h1>
          <p className="text-sm text-muted-foreground">
            Compares the live database to the expected snapshot bundled with the app.
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Checking…" : "Re-check"}
        </Button>
      </header>

      {error ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {(error as Error).message}
          </CardContent>
        </Card>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.ok ? (
        <Card>
          <CardContent className="p-4 text-sm text-emerald-600 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Live schema matches the expected snapshot.
          </CardContent>
        </Card>
      ) : (
        <DiffView diff={data} />
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: SchemaDiffResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tables ({diff.tables.length} differences)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {diff.tables.length === 0 && <p className="text-sm text-muted-foreground">No table differences.</p>}
          {diff.tables.map((t) => (
            <div key={t.table} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm">{t.table}</code>
                <Badge
                  variant={t.status === "missing" ? "destructive" : t.status === "extra" ? "secondary" : "outline"}
                >
                  {t.status}
                </Badge>
              </div>
              {t.missingColumns && (
                <div className="text-xs">
                  <div className="font-medium text-destructive">Missing columns</div>
                  <ul className="ml-4 list-disc">
                    {t.missingColumns.map((c) => (
                      <li key={c.column}>
                        <code>{c.column}</code> ({c.type}, {c.nullable === "YES" ? "nullable" : "not null"})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {t.extraColumns && (
                <div className="text-xs">
                  <div className="font-medium">Extra columns</div>
                  <ul className="ml-4 list-disc">
                    {t.extraColumns.map((c) => (
                      <li key={c.column}>
                        <code>{c.column}</code> ({c.type})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {t.changedColumns && (
                <div className="text-xs">
                  <div className="font-medium text-amber-600">Changed columns</div>
                  <ul className="ml-4 list-disc space-y-1">
                    {t.changedColumns.map((c) => (
                      <li key={c.column}>
                        <code>{c.column}</code>
                        <ul className="ml-4 list-[circle]">
                          {c.changes.map((ch, i) => (
                            <li key={i}>
                              {String(ch.field)}: expected <code>{String(ch.expected)}</code>, got{" "}
                              <code>{String(ch.actual)}</code>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Indexes ({diff.indexes.length} differences)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {diff.indexes.length === 0 && <p className="text-sm text-muted-foreground">No index differences.</p>}
          {diff.indexes.map((i) => (
            <div key={i.key} className="border rounded-md p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <code className="font-mono">{i.key}</code>
                <Badge
                  variant={i.status === "missing" ? "destructive" : i.status === "extra" ? "secondary" : "outline"}
                >
                  {i.status}
                </Badge>
              </div>
              {i.expected && (
                <div>
                  <span className="font-medium">Expected:</span> <code>{i.expected}</code>
                </div>
              )}
              {i.actual && (
                <div>
                  <span className="font-medium">Actual:</span> <code>{i.actual}</code>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
