import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PortalToken = z.string().min(32).max(256);

export const listPortalProposalAttachments = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ portal_token: PortalToken }).parse(input),
  )
  .handler(async ({ data }) => {
    const { listProposalAttachmentsForPortal } = await import(
      "./proposal-attachments.server"
    );
    const attachments = await listProposalAttachmentsForPortal(
      data.portal_token,
    );
    return { attachments };
  });

export const createPortalProposalAttachmentUrl = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) =>
    z
      .object({
        portal_token: PortalToken,
        attachment_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { signProposalAttachmentForPortal } = await import(
      "./proposal-attachments.server"
    );
    return signProposalAttachmentForPortal(
      data.portal_token,
      data.attachment_id,
    );
  });
