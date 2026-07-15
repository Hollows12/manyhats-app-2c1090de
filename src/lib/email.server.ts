// Email sending via Resend.
// Import only from .server.ts files or server function handlers.
// Never import in client-side code — this file accesses RESEND_API_KEY.

import { Resend } from "resend";

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY — configure in server environment");
  return new Resend(key);
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "ManyHats Pro <noreply@manyhats.pro>";
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return { id: data!.id };
}

// ---------------------------------------------------------------------------
// Proposal email template
// ---------------------------------------------------------------------------

export interface ProposalEmailData {
  recipientEmail: string;
  clientName: string;
  projectName: string;
  proposalNumber: string;
  portalUrl: string;
  companyName?: string;
}

export async function sendProposalEmail(d: ProposalEmailData): Promise<{ id: string }> {
  const company = d.companyName ?? "ManyHats Construction LLC";
  return sendEmail({
    to: d.recipientEmail,
    subject: `Your proposal is ready — ${d.proposalNumber}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Proposal Ready</title></head>
<body style="font-family:sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#c9a227;font-size:24px;margin-bottom:8px">${company}</h1>
  <p>Hello ${d.clientName},</p>
  <p>Your proposal <strong>${d.proposalNumber}</strong> for the project <strong>${d.projectName}</strong> is ready for your review.</p>
  <p>Click the button below to view the full proposal, compare options, and provide your digital signature:</p>
  <div style="margin:32px 0;text-align:center">
    <a href="${d.portalUrl}"
       style="background:#c9a227;color:#1a1a2e;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
      View &amp; Sign Proposal
    </a>
  </div>
  <p style="font-size:13px;color:#666">This link is valid for 90 days. If you have any questions, please call us directly.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">${company} · Mike Canter, CEO · 740-600-1374</p>
</body>
</html>`,
  });
}

// ---------------------------------------------------------------------------
// Invoice email template
// ---------------------------------------------------------------------------

export interface InvoiceEmailData {
  recipientEmail: string;
  clientName: string;
  projectName: string;
  invoiceNumber: string;
  totalAmount: string;
  dueDate?: string;
  portalUrl: string;
  companyName?: string;
}

export async function sendInvoiceEmail(d: InvoiceEmailData): Promise<{ id: string }> {
  const company = d.companyName ?? "ManyHats Construction LLC";
  const dueLine = d.dueDate ? `<p>Payment is due by <strong>${d.dueDate}</strong>.</p>` : "";
  return sendEmail({
    to: d.recipientEmail,
    subject: `Invoice ${d.invoiceNumber} — ${d.totalAmount}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice</title></head>
<body style="font-family:sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#c9a227;font-size:24px;margin-bottom:8px">${company}</h1>
  <p>Hello ${d.clientName},</p>
  <p>Invoice <strong>${d.invoiceNumber}</strong> for <strong>${d.projectName}</strong> is ready.</p>
  <p>Total due: <strong style="font-size:18px">${d.totalAmount}</strong></p>
  ${dueLine}
  <div style="margin:32px 0;text-align:center">
    <a href="${d.portalUrl}"
       style="background:#c9a227;color:#1a1a2e;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
      View Invoice &amp; Pay
    </a>
  </div>
  <p style="font-size:13px;color:#666">If you have questions about this invoice, please call us directly.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">${company} · Mike Canter, CEO · 740-600-1374</p>
</body>
</html>`,
  });
}

// ---------------------------------------------------------------------------
// Portal invitation (client file share PIN)
// ---------------------------------------------------------------------------

export interface PortalInvitationEmailData {
  recipientEmail: string;
  clientName: string;
  projectName: string;
  portalUrl: string;
  pin: string;
  companyName?: string;
}

export async function sendPortalInvitationEmail(d: PortalInvitationEmailData): Promise<{ id: string }> {
  const company = d.companyName ?? "ManyHats Construction LLC";
  return sendEmail({
    to: d.recipientEmail,
    subject: `Your project file is ready — ${d.projectName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Client Portal</title></head>
<body style="font-family:sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#c9a227;font-size:24px;margin-bottom:8px">${company}</h1>
  <p>Hello ${d.clientName},</p>
  <p>Your project file for <strong>${d.projectName}</strong> is available in your client portal.</p>
  <p>Use the link below and enter your PIN when prompted:</p>
  <div style="margin:32px 0;text-align:center">
    <a href="${d.portalUrl}"
       style="background:#c9a227;color:#1a1a2e;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
      Open Client Portal
    </a>
  </div>
  <p style="margin-top:24px">Your PIN: <strong style="font-size:20px;letter-spacing:4px">${d.pin}</strong></p>
  <p style="font-size:13px;color:#666">Keep this PIN private. For security, this link will expire based on the share settings.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">${company} · Mike Canter, CEO · 740-600-1374</p>
</body>
</html>`,
  });
}
