import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PortalProposal = {
  error?: string;
  proposal?: { id?: string };
};

async function validateProposalToken(portalToken: string) {
  const { data, error } = await supabaseAdmin.rpc("portal_get_proposal", {
    _token: portalToken,
  });
  const payload = data as PortalProposal | null;
  const proposalId = payload?.proposal?.id;
  if (error || payload?.error || !proposalId) {
    throw new Error("Invalid or expired proposal link");
  }
  return proposalId;
}

export async function listProposalAttachmentsForPortal(portalToken: string) {
  const proposalId = await validateProposalToken(portalToken);
  const { data, error } = await supabaseAdmin
    .from("proposal_attachments")
    .select("id, file_name, mime_type, size_bytes, created_at")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Proposal documents could not be loaded");
  return data ?? [];
}

export async function signProposalAttachmentForPortal(
  portalToken: string,
  attachmentId: string,
) {
  const proposalId = await validateProposalToken(portalToken);
  const { data: attachment, error } = await supabaseAdmin
    .from("proposal_attachments")
    .select("id, storage_path, file_name")
    .eq("id", attachmentId)
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error || !attachment) throw new Error("Proposal document not found");

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from("proposal-attachments")
    .createSignedUrl(attachment.storage_path, 60, {
      download: attachment.file_name,
    });
  if (signedError || !signed?.signedUrl) {
    throw new Error("Proposal document link could not be created");
  }
  return { signedUrl: signed.signedUrl, expiresInSeconds: 60 };
}
