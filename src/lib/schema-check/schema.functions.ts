import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ColumnInfo = {
  column: string;
  type: string;
  nullable: string;
  default: string | null;
};
export type SchemaSnapshot = {
  tables: Record<string, ColumnInfo[]>;
  indexes: Record<string, string>;
};

export const fetchLiveSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin-only: schema introspection is sensitive.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sql = `
      SELECT json_build_object(
        'tables', (
          SELECT json_object_agg(table_name, cols) FROM (
            SELECT c.table_name, json_agg(json_build_object(
              'column', c.column_name,
              'type', c.data_type,
              'nullable', c.is_nullable,
              'default', c.column_default
            ) ORDER BY c.ordinal_position) AS cols
            FROM information_schema.columns c
            WHERE c.table_schema='public'
            GROUP BY c.table_name
          ) t
        ),
        'indexes', (
          SELECT json_object_agg(tablename || '.' || indexname, indexdef)
          FROM pg_indexes WHERE schemaname='public'
        )
      ) AS schema;
    `;
    // Fallback: use a dedicated RPC if you want to avoid raw SQL; for now query via PostgREST rpc pattern.
    // We use a lightweight approach: read from information_schema via supabase-js views is not possible,
    // so we call our own SQL function if present. Otherwise, replicate via multiple queries.

    // Multi-query fallback (works without custom RPC):
    const [{ data: cols, error: colsErr }, { data: idx, error: idxErr }] = await Promise.all([
      supabaseAdmin.schema("information_schema" as never).from("columns" as never)
        .select("table_name,column_name,data_type,is_nullable,column_default,ordinal_position")
        .eq("table_schema", "public"),
      supabaseAdmin.schema("pg_catalog" as never).from("pg_indexes" as never)
        .select("tablename,indexname,indexdef")
        .eq("schemaname", "public"),
    ]);
    if (colsErr) throw new Error(colsErr.message);
    if (idxErr) throw new Error(idxErr.message);

    const tables: Record<string, ColumnInfo[]> = {};
    const rowsCols = (cols ?? []) as Array<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      ordinal_position: number;
    }>;
    rowsCols
      .sort((a, b) => a.ordinal_position - b.ordinal_position)
      .forEach((r) => {
        (tables[r.table_name] ??= []).push({
          column: r.column_name,
          type: r.data_type,
          nullable: r.is_nullable,
          default: r.column_default,
        });
      });

    const indexes: Record<string, string> = {};
    const rowsIdx = (idx ?? []) as Array<{ tablename: string; indexname: string; indexdef: string }>;
    rowsIdx.forEach((r) => {
      indexes[`${r.tablename}.${r.indexname}`] = r.indexdef;
    });

    const snapshot: SchemaSnapshot = { tables, indexes };
    // sql variable is retained for reference; not used to avoid needing a custom RPC.
    void sql;
    return snapshot;
  });
