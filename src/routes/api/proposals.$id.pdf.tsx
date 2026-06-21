import { createFileRoute } from "@tanstack/react-router";
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from "@react-pdf/renderer";
import { COMPANY, formatMoney } from "@/lib/manyhats";
import React from "react";

const NAVY = "#0B1B33";
const GOLD = "#C9A24B";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  cover: { padding: 60, fontSize: 12, color: "#fff", backgroundColor: NAVY, height: "100%" },
  goldBar: { height: 4, backgroundColor: GOLD, marginBottom: 24 },
  brandTitle: { fontFamily: "Helvetica-Bold", fontSize: 28, color: GOLD, letterSpacing: 1 },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 20, color: NAVY, marginBottom: 8 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 14, color: NAVY, marginTop: 16, marginBottom: 6, borderBottomWidth: 1, borderColor: GOLD, paddingBottom: 4 },
  body: { lineHeight: 1.5, marginBottom: 8 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#666", borderTopWidth: 0.5, borderColor: "#ccc", paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  optionRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 6 },
  optionLabel: { width: 50, fontFamily: "Helvetica-Bold", color: GOLD },
  optionTitle: { flex: 1, fontFamily: "Helvetica-Bold" },
  price: { width: 100, textAlign: "right", fontFamily: "Helvetica-Bold", color: NAVY },
  disclaimer: { fontSize: 8, color: "#666", fontStyle: "italic", marginTop: 4 },
});

interface Data {
  proposal: any;
  project: any;
  client: any;
  options: any[];
  photoUrls: string[];
  conceptUrls: string[];
}

function PdfDoc({ proposal, project, client, options, photoUrls, conceptUrls }: Data) {
  const sections: Array<[string, string | undefined]> = [
    ["Executive Summary", proposal.executive_summary],
    ["Existing Conditions", proposal.existing_conditions],
    ["Scope of Work", proposal.scope_of_work],
  ];
  const afterOptions: Array<[string, string | undefined]> = [
    ["Recommendation", proposal.recommendation],
    ["Timeline", proposal.timeline],
    ["Warranty", [proposal.warranty_length, proposal.warranty_notes].filter(Boolean).join("\n\n")],
    ["Exclusions", proposal.exclusions],
    ["Payment Terms", proposal.payment_terms],
  ];

  return (
    <Document>
      {/* Cover */}
      <Page size="LETTER" style={{ padding: 0 }}>
        <View style={styles.cover}>
          <Text style={styles.brandTitle}>ManyHats Construction LLC</Text>
          <Text style={{ marginTop: 4, fontSize: 10, color: GOLD, letterSpacing: 2 }}>{COMPANY.tagline.toUpperCase()}</Text>
          <View style={{ ...styles.goldBar, marginTop: 12 }} />
          <Text style={{ fontSize: 11, marginBottom: 4 }}>{COMPANY.owner} · {COMPANY.ownerTitle}</Text>
          <Text style={{ fontSize: 11, marginBottom: 4 }}>{COMPANY.phone}</Text>

          <View style={{ marginTop: 80 }}>
            <Text style={{ fontSize: 13, color: GOLD, letterSpacing: 2 }}>PROPOSAL</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 32, marginTop: 8, lineHeight: 1.2 }}>{project.name}</Text>
            <Text style={{ marginTop: 12, fontSize: 12 }}>Prepared for {client.name}</Text>
            {project.job_address && <Text style={{ fontSize: 10, marginTop: 2 }}>{[project.job_address, project.city, project.state].filter(Boolean).join(", ")}</Text>}
          </View>

          <View style={{ marginTop: 100, flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 9, color: GOLD, letterSpacing: 1 }}>PROPOSAL NUMBER</Text>
              <Text style={{ fontSize: 14, marginTop: 4 }}>{proposal.proposal_number}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 9, color: GOLD, letterSpacing: 1 }}>DATE</Text>
              <Text style={{ fontSize: 14, marginTop: 4 }}>{new Date(proposal.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* Body — sections, options, more sections */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>{project.name}</Text>
        <Text style={{ color: "#666", marginBottom: 16 }}>Proposal {proposal.proposal_number} · for {client.name}</Text>

        {sections.map(([title, body]) =>
          body ? (
            <View key={title} wrap={false}>
              <Text style={styles.h2}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
          ) : null,
        )}

        {options.length > 0 && (
          <View>
            <Text style={styles.h2}>Options and Pricing</Text>
            {options.sort((a, b) => a.sort_order - b.sort_order).map((o) => (
              <View key={o.id} style={styles.optionRow}>
                <Text style={styles.optionLabel}>{o.tier}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{o.title}{o.is_recommended ? "  ★" : ""}</Text>
                  {o.description && <Text style={{ color: "#444", marginTop: 2 }}>{o.description}</Text>}
                </View>
                <Text style={styles.price}>{formatMoney(Number(o.price))}</Text>
              </View>
            ))}
          </View>
        )}

        {afterOptions.map(([title, body]) =>
          body ? (
            <View key={title} wrap={false}>
              <Text style={styles.h2}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
          ) : null,
        )}

        <View wrap={false}>
          <Text style={styles.h2}>Acceptance</Text>
          <Text style={styles.body}>
            By signing below, the client accepts the scope, pricing, and terms described in this proposal and authorizes ManyHats Construction LLC to perform the work.
          </Text>
          <View style={{ marginTop: 24, flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ width: "45%" }}>
              <Text style={{ borderTopWidth: 0.5, paddingTop: 4 }}>Client signature</Text>
            </View>
            <View style={{ width: "45%" }}>
              <Text style={{ borderTopWidth: 0.5, paddingTop: 4 }}>Date</Text>
            </View>
          </View>
        </View>

        <Footer proposalNumber={proposal.proposal_number} />
      </Page>

      {/* Concepts last, before real photos */}
      {conceptUrls.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.h1}>Conceptual Renderings</Text>
          <Text style={styles.disclaimer}>Conceptual rendering only. Final layout, measurements, structural details, permits, and pricing require confirmed site measurements and approval.</Text>
          {conceptUrls.map((url, i) => (
            <View key={i} style={{ marginTop: 12 }} wrap={false}>
              <Image src={url} style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} />
            </View>
          ))}
          <Footer proposalNumber={proposal.proposal_number} />
        </Page>
      )}

      {/* Real photos last */}
      {photoUrls.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.h1}>Project Photos</Text>
          <Text style={{ color: "#666", marginBottom: 8 }}>Actual site photographs.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {photoUrls.map((url, i) => (
              <View key={i} style={{ width: "48%", marginBottom: 8 }} wrap={false}>
                <Image src={url} style={{ width: "100%", height: 200, objectFit: "cover" }} />
              </View>
            ))}
          </View>
          <Footer proposalNumber={proposal.proposal_number} />
        </Page>
      )}
    </Document>
  );
}

function Footer({ proposalNumber }: { proposalNumber: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{COMPANY.name} · {COMPANY.owner} · {COMPANY.phone}</Text>
      <Text>{proposalNumber}</Text>
    </View>
  );
}

export const Route = createFileRoute("/api/proposals/$id/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: proposal, error } = await supabaseAdmin
          .from("proposals")
          .select("*, proposal_options(*), projects(*, clients(*))")
          .eq("id", params.id)
          .single();
        if (error || !proposal) return new Response("Not found", { status: 404 });

        // Signed URLs for attached photos & approved concepts
        const photoUrls: string[] = [];
        if (proposal.attached_photo_ids?.length) {
          const { data: photos } = await supabaseAdmin
            .from("project_photos").select("storage_path").in("id", proposal.attached_photo_ids);
          for (const p of photos ?? []) {
            const { data } = await supabaseAdmin.storage.from("field-photos").createSignedUrl(p.storage_path, 600);
            if (data?.signedUrl) photoUrls.push(data.signedUrl);
          }
        }
        const { data: concepts } = await supabaseAdmin
          .from("concept_requests").select("generated_image_path")
          .eq("project_id", proposal.project_id).eq("approved_for_proposal", true);
        const conceptUrls: string[] = [];
        for (const c of concepts ?? []) {
          if (!c.generated_image_path) continue;
          const { data } = await supabaseAdmin.storage.from("concepts").createSignedUrl(c.generated_image_path, 600);
          if (data?.signedUrl) conceptUrls.push(data.signedUrl);
        }

        const buf = await renderToBuffer(
          <PdfDoc
            proposal={proposal}
            project={proposal.projects}
            client={proposal.projects.clients}
            options={proposal.proposal_options ?? []}
            photoUrls={photoUrls}
            conceptUrls={conceptUrls}
          />
        );

        return new Response(new Uint8Array(buf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${proposal.proposal_number}.pdf"`,
          },
        });
      },
    },
  },
});
