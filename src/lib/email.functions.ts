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

// ---------------------------------------------------------------------------
// Send portal invitation email (client file share PIN delivery)
// ---------------------------------------------------------------------------

const SendPortalInvitationInput = z.object({
  share_id: z.string().uuid(),
});

export const sendPortalInvitationEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendPortalInvitationInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Load the share — confirm it belongs to the caller's company via project/company scope
    const { data: share, error: shareErr } = await (supabase as any)
      .from("client_file_shares")
      .select(
        "id, token, recipient_email, pin_hash, expires_at, revoked_at, projects(id, name, clients(name, email), company_id)",
      )
      .eq("id", data.share_id)
      .single();
    if (shareErr || !share) throw new Error("Share not found or access denied");
    if (share.revoked_at) throw new Error("This share link has been revoked");
    if (new Date(share.expires_at) < new Date()) throw new Error("This share link has expired");

    // Determine recipient email — prefer share.recipient_email, fall back to client email
    const project = share.projects as any;
    const client = project?.clients as any;
    const recipientEmail: string | null =
      share.recipient_email ?? client?.email ?? null;
    if (!recipientEmail) {
      throw new Error(
        "No email address on file. Add an email to the share or the client record.",
      );
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      throw new Error("The recipient email address is not valid");
    }

    // Rotate the PIN so the client always gets a fresh one via email
    const { data: rotated, error: rotErr } = await (supabase.rpc as any)(
      "rotate_client_file_share_pin",
      { _share_id: data.share_id },
    );
    if (rotErr) throw rotErr;
    const newPin: string = (rotated as any)?.pin;
    if (!newPin) throw new Error("Could not rotate PIN");

    const origin = process.env.APP_ORIGIN ?? "https://app.manyhats.pro";
    const portalUrl = `${origin}/portal/client-file/${share.token}`;

    const { sendPortalInvitationEmail } = await import("./email.server");
    await sendPortalInvitationEmail({
      recipientEmail,
      clientName: client?.name ?? "Valued Client",
      projectName: project?.name ?? "Your Project",
      portalUrl,
      pin: newPin,
    });

    // Return only a confirmation — never expose pin in the response payload
    return { ok: true, recipientEmail };
  });

