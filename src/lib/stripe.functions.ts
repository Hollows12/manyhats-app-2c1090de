// Server functions for Stripe payment processing.
// Deposit and final payment flows for the contractor workflow.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Create a payment intent for a deposit
// ---------------------------------------------------------------------------

const CreateDepositIntentInput = z.object({
  deposit_id: z.string().uuid(),
});

export const createDepositPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateDepositIntentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: deposit, error } = await supabase
      .from("deposits")
      .select("id, amount, status, updated_at, project_id, projects(name, clients(name))")
      .eq("id", data.deposit_id)
      .single();
    if (error || !deposit) throw new Error("Deposit not found");
    if ((deposit.status as string) === "paid") throw new Error("Deposit already paid");

    const project = deposit.projects as any;
    const client = project?.clients as any;
    const amountCents = Math.round(Number(deposit.amount) * 100);
    const idempotencyKey = `deposit:${deposit.id}:${amountCents}:${deposit.updated_at}`;

    const { createPaymentIntent } = await import("./stripe.server");
    const intent = await createPaymentIntent({
      amountCents,
      idempotencyKey,
      description: `Deposit — ${project?.name ?? "Project"}`,
      metadata: {
        deposit_id: deposit.id,
        project_id: String(deposit.project_id),
        client_name: client?.name ?? "",
        type: "deposit",
      },
    });

    return { clientSecret: intent.client_secret, intentId: intent.id, amountCents };
  });

// ---------------------------------------------------------------------------
// Create a payment intent for an invoice
// ---------------------------------------------------------------------------

const CreateInvoiceIntentInput = z.object({
  invoice_id: z.string().uuid(),
});

export const createInvoicePaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInvoiceIntentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: inv, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, balance_due, status, updated_at, project_id, projects(name, clients(name))")
      .eq("id", data.invoice_id)
      .single();
    if (error || !inv) throw new Error("Invoice not found");
    if ((inv.status as string) === "paid") throw new Error("Invoice already paid");

    const project = inv.projects as any;
    const client = project?.clients as any;
    const amountCents = Math.round(Number(inv.balance_due) * 100);
    if (amountCents <= 0) throw new Error("Invoice balance is zero");
    const idempotencyKey = `invoice:${inv.id}:${amountCents}:${inv.updated_at}`;

    const { createPaymentIntent } = await import("./stripe.server");
    const intent = await createPaymentIntent({
      amountCents,
      idempotencyKey,
      description: `Invoice ${inv.invoice_number} — ${project?.name ?? "Project"}`,
      metadata: {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        project_id: String(inv.project_id),
        client_name: client?.name ?? "",
        type: "invoice_payment",
      },
    });

    return { clientSecret: intent.client_secret, intentId: intent.id, amountCents };
  });

// ---------------------------------------------------------------------------
// Public portal: create payment intent without staff auth (token-gated)
// ---------------------------------------------------------------------------

const CreatePortalPaymentIntentInput = z.object({
  invoice_id: z.string().uuid(),
  portal_token: z.string().min(1),
});

export const createPortalInvoicePaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreatePortalPaymentIntentInput.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) throw new Error("Supabase environment variables not set");

    const adminClient = createClient(url, key);

    // Validate portal token
    const { data: tokenCheck, error: tcErr } = await (adminClient.rpc as any)(
      "portal_get_invoice",
      { _token: data.portal_token },
    );
    if (tcErr || !tokenCheck) throw new Error("Invalid portal token");
    const payload = tokenCheck as any;
    if (payload.error) throw new Error("Invalid or expired portal link");
    if (payload.invoice?.id !== data.invoice_id) throw new Error("Token/invoice mismatch");

    const inv = payload.invoice;
    const amountCents = Math.round(Number(inv.balance_due) * 100);
    if (amountCents <= 0) throw new Error("No balance due");

    const { createPaymentIntent } = await import("./stripe.server");
    const idempotencyKey = `portal_invoice:${data.invoice_id}:${amountCents}:${inv.updated_at ?? inv.id}`;
    const intent = await createPaymentIntent({
      amountCents,
      idempotencyKey,
      description: `Invoice ${inv.invoice_number} — ${payload.project?.name ?? "Project"}`,
      metadata: {
        invoice_id: data.invoice_id,
        invoice_number: inv.invoice_number,
        client_name: payload.client_name ?? "",
        type: "portal_invoice_payment",
      },
    });

    return { clientSecret: intent.client_secret, intentId: intent.id, amountCents };
  });

// ---------------------------------------------------------------------------
// Public portal: create payment intent for deposit without staff auth (token-gated)
// ---------------------------------------------------------------------------

const CreatePortalDepositPaymentIntentInput = z.object({
  deposit_id: z.string().uuid(),
  portal_token: z.string().min(1),
});

export const createPortalDepositPaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreatePortalDepositPaymentIntentInput.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) throw new Error("Supabase environment variables not set");

    const adminClient = createClient(url, key);

    // Validate portal token via the proposal RPC
    const { data: tokenCheck, error: tcErr } = await (adminClient.rpc as any)(
      "portal_get_proposal",
      { _token: data.portal_token },
    );
    if (tcErr || !tokenCheck) throw new Error("Invalid portal token");
    const payload = tokenCheck as any;
    if (payload.error) throw new Error("Invalid or expired portal link");

    // Look up the deposit and confirm it belongs to the same project
    const { data: deposit, error: depErr } = await adminClient
      .from("deposits")
      .select("id, amount, status, updated_at, project_id")
      .eq("id", data.deposit_id)
      .single();
    if (depErr || !deposit) throw new Error("Deposit not found");

    // Verify the deposit is for the same project as the portal proposal
    const proposalProjectId: string | undefined =
      (payload.project as any)?.id ??
      (payload.project as any)?.project_id ??
      (payload as any).project_id;
    if (!proposalProjectId) {
      throw new Error("Proposal project context missing");
    }
    if (String(deposit.project_id) !== String(proposalProjectId)) {
      throw new Error("Deposit/proposal mismatch");
    }

    if ((deposit.status as string) === "paid") throw new Error("Deposit already paid");

    const amountCents = Math.round(Number(deposit.amount) * 100);
    if (amountCents <= 0) throw new Error("Deposit amount is zero");

    const { createPaymentIntent } = await import("./stripe.server");
    const idempotencyKey = `portal_deposit:${deposit.id}:${amountCents}:${deposit.updated_at ?? deposit.id}`;
    const intent = await createPaymentIntent({
      amountCents,
      idempotencyKey,
      description: `Deposit — ${(payload.project as any)?.name ?? "Project"}`,
      metadata: {
        deposit_id: deposit.id,
        project_id: String(deposit.project_id),
        client_name: payload.client_name ?? "",
        type: "deposit",
      },
    });

    return { clientSecret: intent.client_secret, intentId: intent.id, amountCents };
  });
