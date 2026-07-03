import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_project",
  title: "Get project detail",
  description: "Fetch a single ManyHats project by id, including client, estimates, and proposals summary.",
  inputSchema: {
    id: z.string().uuid().describe("Project id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: project, error } = await sb
      .from("projects")
      .select("*, clients(id, name, phone, email)")
      .eq("id", id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!project) return { content: [{ type: "text", text: "Project not found" }], isError: true };
    const [{ data: estimates }, { data: proposals }] = await Promise.all([
      sb.from("estimates").select("id, name, total, status, created_at").eq("project_id", id),
      sb.from("proposals").select("id, proposal_number, status, created_at").eq("project_id", id),
    ]);
    const payload = { project, estimates: estimates ?? [], proposals: proposals ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
