import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEntitlement } from "@/lib/entitlements.server";

const Input = z.object({
  rough_notes: z.string().min(5),
  tone: z.enum(["professional", "board_ready", "grant_friendly"]).default("professional"),
});

const ScopeSchema = z.object({
  executive_summary: z.string(),
  existing_conditions: z.string(),
  scope_of_work: z.string(),
  recommendation: z.string(),
  warranty: z.string(),
  exclusions: z.string(),
});

export const writeScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    await requireEntitlement(context, "ai_generators");

    const { createConfiguredAiProvider } = await import("./ai-gateway.server");
    const { config, provider } = createConfiguredAiProvider();

    const toneText = {
      professional: "Professional, clear, contractor-grade.",
      board_ready:
        "Board-ready: formal, concise, suitable for nonprofit board or municipal review.",
      grant_friendly:
        "Grant / donation-friendly: emphasize stewardship, historic value, public benefit, phased stabilization.",
    }[data.tone];

    const system = `You are the proposal writer for ManyHats Construction LLC (Mike Canter, CEO, 740-600-1374, veteran-owned).
Write protective, clear contractor language. Never promise pricing from photos. Never invent dimensions.
Tone: ${toneText}
Output structured fields. Keep each field tight and self-contained.`;

    const { experimental_output } = await generateText({
      model: provider(config.chatModel),
      system,
      prompt: `Rough field notes:\n\n${data.rough_notes}`,
      experimental_output: Output.object({ schema: ScopeSchema }),
    });

    return experimental_output;
  });
