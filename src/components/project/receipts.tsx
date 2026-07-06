import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Receipt, Trash2, Upload, DollarSign, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/manyhats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = ["material", "equipment", "fuel", "subcontractor", "misc"];

export function ProjectReceipts({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["receipts", projectId],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("receipts")
          .select("*")
          .eq("project_id", projectId)
          .order("purchased_at", { ascending: false })
      ).data ?? [],
  });

  const [form, setForm] = useState({ vendor: "", amount: "", category: "material", purchased_at: new Date().toISOString().slice(0, 10), notes: "" });
  const [file, setFile] = useState<File | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Attach a receipt photo.");
      const { data: { user } } = await supabase.auth.getUser();
      const path = `receipts/${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("field-photos").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await (supabase as any).from("receipts").insert({
        project_id: projectId,
        uploaded_by: user?.id,
        storage_path: path,
        vendor: form.vendor || null,
        amount: Number(form.amount) || 0,
        category: form.category,
        purchased_at: form.purchased_at,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts", projectId] });
      setForm({ vendor: "", amount: "", category: "material", purchased_at: new Date().toISOString().slice(0, 10), notes: "" });
      setFile(null);
      toast.success("Receipt saved.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (r: any) => {
      await supabase.storage.from("field-photos").remove([r.storage_path]);
      await (supabase as any).from("receipts").delete().eq("id", r.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts", projectId] }),
  });

  const pushToJobCost = useMutation({
    mutationFn: async (r: any) => {
      // Find or create a matching job_costs row (by category)
      const { data: existing } = await supabase
        .from("job_costs")
        .select("id, actual")
        .eq("project_id", projectId)
        .eq("category", r.category as any)
        .maybeSingle();
      let jobCostId: string;
      if (existing) {
        jobCostId = existing.id;
        await supabase
          .from("job_costs")
          .update({ actual: Number(existing.actual || 0) + Number(r.amount || 0) })
          .eq("id", existing.id);
      } else {
        const { data: created, error } = await supabase
          .from("job_costs")
          .insert({ project_id: projectId, category: r.category, estimated: 0, actual: Number(r.amount) || 0 } as any)
          .select("id")
          .single();
        if (error) throw error;
        jobCostId = created.id;
      }
      await (supabase as any).from("receipts").update({ job_cost_id: jobCostId }).eq("id", r.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts", projectId] });
      qc.invalidateQueries({ queryKey: ["job-costs", projectId] });
      toast.success("Added to Job Costs.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = (list.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Receipt className="h-5 w-5 text-gold" />
          Receipts
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Snap a receipt photo, tag the cost, push straight to Job Costs. Total logged: <strong>{formatMoney(total)}</strong>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_120px_140px_120px_1fr_auto] md:items-end"
        >
          <div>
            <Label className="text-xs">Vendor</Label>
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Home Depot" />
          </div>
          <div>
            <Label className="text-xs">Amount</Label>
            <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.purchased_at} onChange={(e) => setForm({ ...form, purchased_at: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Photo</Label>
            <Input type="file" accept="image/*" capture="environment" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="submit" disabled={add.isPending}>
            <Upload className="mr-1 h-4 w-4" />
            {add.isPending ? "Saving…" : "Save"}
          </Button>
        </form>

        {(list.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            No receipts yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {list.data!.map((r: any) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Badge variant="outline" className="text-[10px] uppercase">{r.category}</Badge>
                <span className="font-medium">{r.vendor || "Unknown vendor"}</span>
                <span className="text-xs text-muted-foreground">{r.purchased_at}</span>
                <span className="ml-auto flex items-center gap-1 tabular-nums font-semibold">
                  <DollarSign className="h-3 w-3" />
                  {formatMoney(r.amount)}
                </span>
                {r.job_cost_id ? (
                  <Badge className="bg-emerald-100 text-emerald-900 border-0 text-[10px]">In Job Costs</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => pushToJobCost.mutate(r)}>
                    <Link2 className="mr-1 h-3 w-3" /> Push
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(r)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
