import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FileText,
  Download,
  Sparkles,
  Loader2,
  Plus,
  Link2,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { generateProposalNumber, formatMoney } from "@/lib/manyhats";
import { useServerFn } from "@tanstack/react-start";
import { writeScope } from "@/lib/scope-writer.functions";

export function ProjectProposal({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const proposal = useQuery({
    queryKey: ["proposal", projectId],
    queryFn: async () =>
      (
        await supabase
          .from("proposals")
          .select("*, proposal_options(*)")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });
  const measurementsCount = useQuery({
    queryKey: ["measurements-confirmed-count", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("measurements")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("is_confirmed", true);
      return count ?? 0;
    },
  });
  const pendingRecs = useQuery({
    queryKey: ["ai-recs-pending", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_estimate_recommendations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const seq = Math.floor(Math.random() * 900) + 100;
      const { data, error } = await supabase
        .from("proposals")
        .insert({
          project_id: projectId,
          proposal_number: generateProposalNumber(seq),
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal", projectId] }),
    onError: (e) => toast.error(e.message),
  });

  if (proposal.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!proposal.data) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">No proposal yet for this project.</div>
          <Button onClick={() => create.mutate()}>Create proposal</Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <ProposalEditor
      proposal={proposal.data}
      confirmedCount={measurementsCount.data ?? 0}
      pendingRecCount={pendingRecs.data ?? 0}
    />
  );
}

function ProposalEditor({
  proposal,
  confirmedCount,
  pendingRecCount,
}: {
  proposal: any;
  confirmedCount: number;
  pendingRecCount: number;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(proposal);
  const writeScopeFn = useServerFn(writeScope);
  const [aiBusy, setAiBusy] = useState(false);
  const [roughNotes, setRoughNotes] = useState("");
  const [tone, setTone] = useState<"professional" | "board_ready" | "grant_friendly">(
    "professional",
  );

  const save = useMutation({
    mutationFn: async () => {
      const nextStatus = form.status ?? proposal.status;
      const promoting = nextStatus !== "draft" && proposal.status === "draft";
      if (promoting && pendingRecCount > 0) {
        throw new Error(
          `Blocked: ${pendingRecCount} AI recommendation${pendingRecCount === 1 ? "" : "s"} still pending contractor review.`,
        );
      }
      const { error } = await supabase
        .from("proposals")
        .update({
          executive_summary: form.executive_summary,
          existing_conditions: form.existing_conditions,
          scope_of_work: form.scope_of_work,
          recommendation: form.recommendation,
          timeline: form.timeline,
          warranty_length: form.warranty_length,
          warranty_notes: form.warranty_notes,
          exclusions: form.exclusions,
          payment_terms: form.payment_terms,
          grant_friendly: form.grant_friendly,
          status: nextStatus,
        })
        .eq("id", proposal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal", proposal.project_id] });
      toast.success("Saved.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const addOption = useMutation({
    mutationFn: async ({ tier, price }: { tier: string; price: number }) => {
      await supabase
        .from("proposal_options")
        .insert({
          proposal_id: proposal.id,
          tier,
          title: `${tier} package`,
          price,
          sort_order: (proposal.proposal_options?.length ?? 0) + 1,
        });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal", proposal.project_id] }),
  });

  async function runAi() {
    if (!roughNotes.trim()) {
      toast.error("Add some rough notes first.");
      return;
    }
    setAiBusy(true);
    try {
      const result = await writeScopeFn({ data: { rough_notes: roughNotes, tone } });
      setForm({
        ...form,
        executive_summary: result.executive_summary,
        existing_conditions: result.existing_conditions,
        scope_of_work: result.scope_of_work,
        recommendation: result.recommendation,
        warranty_notes: result.warranty,
        exclusions: result.exclusions,
      });
      toast.success("AI scope draft loaded into the form. Review and Save.");
    } catch (e: any) {
      toast.error(e.message ?? "AI generation failed");
    } finally {
      setAiBusy(false);
    }
  }

  const canMarkReady = confirmedCount > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="font-display flex items-center gap-3">
              <FileText className="h-5 w-5 text-gold" />
              {proposal.proposal_number}
              <Badge variant="outline">{proposal.status}</Badge>
            </CardTitle>
            {!canMarkReady && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠ No confirmed measurements yet. Final pricing requires at least one confirmed
                measurement.
              </p>
            )}
            {pendingRecCount > 0 && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠ {pendingRecCount} AI recommendation{pendingRecCount === 1 ? "" : "s"} pending
                contractor approval. Review in the Estimate tab before sending.
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <SendProposalButton proposalId={proposal.id} status={proposal.status} />
            <ClientLinkButtons proposalId={proposal.id} hasToken={!!proposal.portal_token} />
            <Button asChild variant="outline" size="sm">
              <a href={`/api/proposals/${proposal.id}/pdf`} target="_blank" rel="noreferrer">
                <Download className="mr-1 h-4 w-4" /> PDF
              </a>
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Scope Writer */}
          <details className="rounded-md border border-gold/40 bg-gold/5 p-3">
            <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              AI Scope Writer
            </summary>
            <div className="mt-3 space-y-2">
              <Textarea
                rows={4}
                placeholder="Paste rough notes from the field. The AI will draft the executive summary, scope, conditions, recommendation, warranty, and exclusions in contractor-grade wording."
                value={roughNotes}
                onChange={(e) => setRoughNotes(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="board_ready">Board-ready</SelectItem>
                    <SelectItem value="grant_friendly">Grant-friendly</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={runAi} disabled={aiBusy} size="sm">
                  {aiBusy ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-4 w-4" />
                  )}
                  Generate
                </Button>
              </div>
            </div>
          </details>

          <Field
            label="Executive summary"
            value={form.executive_summary}
            onChange={(v) => setForm({ ...form, executive_summary: v })}
          />
          <Field
            label="Existing conditions"
            value={form.existing_conditions}
            onChange={(v) => setForm({ ...form, existing_conditions: v })}
          />
          <Field
            label="Scope of work"
            value={form.scope_of_work}
            onChange={(v) => setForm({ ...form, scope_of_work: v })}
            rows={5}
          />
          <Field
            label="Recommendation"
            value={form.recommendation}
            onChange={(v) => setForm({ ...form, recommendation: v })}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Timeline"
              value={form.timeline}
              onChange={(v) => setForm({ ...form, timeline: v })}
              rows={2}
            />
            <Field
              label="Warranty length"
              value={form.warranty_length}
              onChange={(v) => setForm({ ...form, warranty_length: v })}
              rows={2}
            />
          </div>
          <Field
            label="Warranty notes"
            value={form.warranty_notes}
            onChange={(v) => setForm({ ...form, warranty_notes: v })}
          />
          <Field
            label="Exclusions"
            value={form.exclusions}
            onChange={(v) => setForm({ ...form, exclusions: v })}
          />
          <Field
            label="Payment terms"
            value={form.payment_terms}
            onChange={(v) => setForm({ ...form, payment_terms: v })}
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={form.grant_friendly}
              onCheckedChange={(v) => setForm({ ...form, grant_friendly: v })}
              id="gf"
            />
            <Label htmlFor="gf" className="text-xs">
              Grant / donation-friendly wording
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Good / Better / Best options</CardTitle>
          <div className="flex gap-1">
            {["Good", "Better", "Best"].map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                onClick={() => addOption.mutate({ tier: t, price: 0 })}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {(proposal.proposal_options ?? [])
              .sort((a: any, b: any) => a.sort_order - b.sort_order)
              .map((o: any) => (
                <ProposalOptionCard key={o.id} option={o} />
              ))}
            {(proposal.proposal_options ?? []).length === 0 && (
              <div className="md:col-span-3 rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Add Good / Better / Best option cards above.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProposalOptionCard({ option }: { option: any }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState({
    title: option.title,
    description: option.description ?? "",
    price: String(option.price),
    is_recommended: option.is_recommended,
  });
  const save = useMutation({
    mutationFn: async () => {
      await supabase
        .from("proposal_options")
        .update({ ...edit, price: Number(edit.price) })
        .eq("id", option.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal", option.proposal_id] }),
  });
  const del = useMutation({
    mutationFn: async () => {
      await supabase.from("proposal_options").delete().eq("id", option.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal", option.proposal_id] }),
  });
  return (
    <div
      className={`rounded-md border p-3 space-y-2 ${edit.is_recommended ? "border-gold ring-gold" : ""}`}
    >
      <Badge variant="outline" className="border-gold text-gold-foreground bg-gold/10">
        {option.tier}
      </Badge>
      <Input
        value={edit.title}
        onChange={(e) => setEdit({ ...edit, title: e.target.value })}
        className="font-semibold"
      />
      <Textarea
        rows={3}
        value={edit.description}
        onChange={(e) => setEdit({ ...edit, description: e.target.value })}
        placeholder="What's included"
      />
      <Input
        type="number"
        value={edit.price}
        onChange={(e) => setEdit({ ...edit, price: e.target.value })}
      />
      <div className="text-lg font-display font-bold tabular-nums text-navy">
        {formatMoney(Number(edit.price))}
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={edit.is_recommended}
          onCheckedChange={(v) => setEdit({ ...edit, is_recommended: v })}
          id={`r-${option.id}`}
        />
        <Label htmlFor={`r-${option.id}`} className="text-xs">
          Recommended
        </Label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => del.mutate()}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SendProposalButton({ proposalId, status }: { proposalId: string; status: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("send_proposal", {
        _proposal_id: proposalId,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      const url = `${window.location.origin}/portal/proposal/${r.token}`;
      await navigator.clipboard.writeText(url);

      // Attempt email delivery (requires RESEND_API_KEY to be configured)
      try {
        const { sendProposalEmailFn } = await import("@/lib/email.functions");
        await sendProposalEmailFn({ data: { proposal_id: proposalId } });
        toast.success("Proposal sent by email. Client link also copied.");
      } catch (emailErr: any) {
        const msg: string = emailErr?.message ?? "";
        if (msg.includes("RESEND_API_KEY")) {
          toast.success(
            "Proposal marked sent. Client link copied. (Email not configured — set RESEND_API_KEY to enable email delivery.)",
          );
        } else {
          toast.success("Proposal marked sent. Client link copied.");
          console.warn("[proposal send] Email delivery failed:", msg);
        }
      }

      qc.invalidateQueries({ queryKey: ["proposal"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not send");
    } finally {
      setBusy(false);
    }
  }
  const sent = status !== "draft";
  return (
    <Button size="sm" variant={sent ? "outline" : "default"} disabled={busy} onClick={send}>
      <Send className="mr-1 h-4 w-4" />
      {sent ? "Resend link" : "Send proposal"}
    </Button>
  );
}

function ClientLinkButtons({ proposalId, hasToken }: { proposalId: string; hasToken: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function ensure(rotate: boolean) {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("ensure_proposal_portal_token", {
        _proposal_id: proposalId,
        _rotate: rotate,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      const url = `${window.location.origin}/portal/proposal/${r.token}`;
      await navigator.clipboard.writeText(url);
      toast.success(rotate ? "New client link copied." : "Client link copied to clipboard.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not create client link");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("revoke_proposal_portal_token", {
        _proposal_id: proposalId,
      });
      if (error) throw error;
      toast.success("Client link revoked.");
      qc.invalidateQueries({ queryKey: ["proposal"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not revoke");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => ensure(false)}>
        <Link2 className="mr-1 h-4 w-4" /> Copy link
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => ensure(true)}
        title="Rotate link (invalidates old URL)"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      {hasToken && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={revoke} title="Revoke link">
          <XCircle className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </>
  );
}
