import { supabase } from "@/integrations/supabase/client";

export async function openStaffProposalPdf(proposalId: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const response = await fetch(`/api/proposals/${proposalId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Your session has expired. Sign in again." : "Could not create the proposal PDF.");
  }
  const url = URL.createObjectURL(await response.blob());
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("Allow pop-ups to open the proposal PDF.");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
