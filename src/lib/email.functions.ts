// Server functions for transactional email delivery.
// Each function requires an authenticated Supabase session (staff only).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendProposalEmailInput = z.object({
  proposal_id: z.string().uuid(),
});

export const sendProposalEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendProposalEmailInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Load proposal + project + client in one query
    const { data: prop, error: propErr } = await supabase
      .from("proposals")
      .select("id, proposal_number, portal_token, portal_token_expires_at, status, projects(id, name, clients(name, email))")
      .eq("id", data.proposal_id)
      .single();
    if (propErr || !prop) throw new Error("Proposal not found");

    const project = prop.projects as any;
    const client = project?.clients as any;
    const recipientEmail: string | null = client?.email ?? null;
    if (!recipientEmail) throw new Error("Client has no email address on file");

    // Ensure portal token is fresh (call RPC)
    const { data: rpcResult, error: rpcErr } = await (supabase.rpc as any)("send_proposal", {
      _proposal_id: data.proposal_id,
    });
    if (rpcErr) throw rpcErr;
    const rpc = rpcResult as any;
    if (rpc?.error) throw new Error(rpc.error);

    const token: string = rpc.token;
    const origin = process.env.APP_ORIGIN ?? "https://app.manyhats.pro";
    const portalUrl = `${origin}/portal/proposal/${token}`;

    const { sendProposalEmail } = await import("./email.server");
    await sendProposalEmail({
      recipientEmail,
      clientName: client?.name ?? "Valued Client",
      projectName: project?.name ?? "Your Project",
      proposalNumber: prop.proposal_number,
      portalUrl,
    });

    return { ok: true, portalUrl };
  });

const SendInvoiceEmailInput = z.object({
  invoice_id: z.string().uuid(),
});

export const sendInvoiceEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInvoiceEmailInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Load invoice + project + client
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, due_date, projects(id, name, clients(name, email))")
      .eq("id", data.invoice_id)
      .single();
    if (invErr || !inv) throw new Error("Invoice not found");

    const project = inv.projects as any;
    const client = project?.clients as any;
    const recipientEmail: string | null = client?.email ?? null;
    if (!recipientEmail) throw new Error("Client has no email address on file");

    // Ensure portal token exists
    const { data: tokenResult, error: tokenErr } = await (supabase.rpc as any)(
      "ensure_invoice_portal_token",
      { _invoice_id: data.invoice_id, _rotate: false },
    );
    if (tokenErr) throw tokenErr;
    const tr = tokenResult as any;
    if (tr?.error) throw new Error(tr.error);

    // Record sent_at
    await supabase
      .from("invoices")
      .update({ sent_at: new Date().toISOString(), status: "sent" } as any)
      .eq("id", data.invoice_id)
      .in("status" as any, ["draft"]);

    const origin = process.env.APP_ORIGIN ?? "https://app.manyhats.pro";
    const portalUrl = `${origin}/portal/invoice/${tr.token}`;

    const { formatMoney } = await import("./manyhats");
    const { sendInvoiceEmail } = await import("./email.server");
    await sendInvoiceEmail({
      recipientEmail,
      clientName: client?.name ?? "Valued Client",
      projectName: project?.name ?? "Your Project",
      invoiceNumber: inv.invoice_number,
      totalAmount: formatMoney(Number(inv.total)),
      dueDate: (inv as any).due_date ?? undefined,
      portalUrl,
    });

    return { ok: true, portalUrl };
  });
