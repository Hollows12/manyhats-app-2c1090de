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
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_public_schema_snapshot" as never);
    if (error) throw new Error(error.message);
    return (data ?? { tables: {}, indexes: {} }) as SchemaSnapshot;
  });
