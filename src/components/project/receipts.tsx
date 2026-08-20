import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  DollarSign,
  Eye,
  Link2,
  Receipt,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/manyhats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "material",
  "equipment",
  "fuel",
  "subcontractor",
  "permit",
  "disposal",
  "misc",
];
const TAX_CATEGORIES = [
  ["job_materials", "Job materials"],
  ["equipment", "Equipment"],
  ["vehicle_mileage", "Vehicle / mileage"],
  ["subcontractor", "Subcontractor"],
  ["permits_fees", "Permits and fees"],
  ["office", "Office"],
  ["advertising", "Advertising"],
  ["insurance", "Insurance"],
  ["meals", "Business meals"],
  ["other", "Other"],
];

const emptyForm = () => ({
  vendor: "",
  amount: "",
  subtotal: "",
  sales_tax: "",
  category: "material",
  tax_category: "job_materials",
  deductible_pct: "100",
  payment_method: "",
  receipt_number: "",
  purchased_at: new Date().toISOString().slice(0, 10),
  notes: "",
});

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

  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Attach a receipt photo or PDF.");
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("Receipt files must be 15 MB or smaller.");
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${projectId}/${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const amount = Number(form.amount);
      const salesTax = Number(form.sales_tax) || 0;
      const subtotal =
        form.subtotal.trim() === "" ? Math.max(0, amount - salesTax) : Number(form.subtotal);
      const { error } = await (supabase as any).from("receipts").insert({
        project_id: projectId,
        uploaded_by: user.id,
        storage_path: path,
        vendor: form.vendor.trim() || null,
        amount,
        subtotal,
        sales_tax: salesTax,
        category: form.category,
        tax_category: form.tax_category,
        deductible_pct: Number(form.deductible_pct),
        payment_method: form.payment_method.trim() || null,
        receipt_number: form.receipt_number.trim() || null,
        purchased_at: form.purchased_at,
        notes: form.notes.trim() || null,
      });
      if (error) {
        await supabase.storage.from("receipts").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts", projectId] });
      setForm(emptyForm());
      setFile(null);
      toast.success("Receipt and tax details saved.");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (receipt: any) => {
      const { error } = await (supabase as any)
        .from("receipts")
        .delete()
        .eq("id", receipt.id);
      if (error) throw error;
      const { error: storageError } = await supabase.storage
        .from("receipts")
        .remove([receipt.storage_path]);
      if (storageError) {
        toast.warning("Receipt record removed; private file cleanup will need retrying.");
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["receipts", projectId] }),
    onError: (error: any) => toast.error(error.message),
  });

  const pushToJobCost = useMutation({
    mutationFn: async (receipt: any) => {
      const { error } = await (supabase.rpc as any)(
        "post_receipt_to_job_cost",
        { _receipt_id: receipt.id },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts", projectId] });
      qc.invalidateQueries({ queryKey: ["job-costs", projectId] });
      toast.success("Receipt posted to Job Costs.");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const verify = useMutation({
    mutationFn: async (receipt: any) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");
      const { error } = await (supabase as any)
        .from("receipts")
        .update({
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", receipt.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts", projectId] });
      toast.success("Receipt verified.");
    },
    onError: (error: any) => toast.error(error.message),
  });

  async function openReceipt(receipt: any) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Private receipt link could not be created.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const receipts = list.data ?? [];
  const total = receipts.reduce(
    (sum: number, receipt: any) => sum + Number(receipt.amount || 0),
    0,
  );
  const salesTax = receipts.reduce(
    (sum: number, receipt: any) => sum + Number(receipt.sales_tax || 0),
    0,
  );
  const deductible = receipts.reduce(
    (sum: number, receipt: any) =>
      sum +
      Number(receipt.amount || 0) *
        (Number(receipt.deductible_pct ?? 100) / 100),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Receipt className="h-5 w-5 text-gold" />
          Receipts, Expenses & Tax Tracking
        </CardTitle>
        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <Summary label="Total expenses" value={total} />
          <Summary label="Sales tax paid" value={salesTax} />
          <Summary label="Potentially deductible" value={deductible} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Tax categories support bookkeeping and export; final deductibility should be reviewed by a qualified tax professional.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
          className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-4"
        >
          <Field label="Vendor">
            <Input
              value={form.vendor}
              onChange={(event) => setForm({ ...form, vendor: event.target.value })}
              placeholder="Local supplier"
            />
          </Field>
          <Field label="Total amount">
            <Input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </Field>
          <Field label="Subtotal before tax">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.subtotal}
              onChange={(event) => setForm({ ...form, subtotal: event.target.value })}
              placeholder="Calculated if blank"
            />
          </Field>
          <Field label="Sales tax">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.sales_tax}
              onChange={(event) => setForm({ ...form, sales_tax: event.target.value })}
            />
          </Field>
          <Field label="Job-cost category">
            <Select
              value={form.category}
              onValueChange={(value) => setForm({ ...form, category: value })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tax category">
            <Select
              value={form.tax_category}
              onValueChange={(value) => setForm({ ...form, tax_category: value })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAX_CATEGORIES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Deductible planning %">
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.deductible_pct}
              onChange={(event) =>
                setForm({ ...form, deductible_pct: event.target.value })
              }
            />
          </Field>
          <Field label="Purchase date">
            <Input
              type="date"
              value={form.purchased_at}
              onChange={(event) =>
                setForm({ ...form, purchased_at: event.target.value })
              }
            />
          </Field>
          <Field label="Payment method">
            <Input
              value={form.payment_method}
              onChange={(event) =>
                setForm({ ...form, payment_method: event.target.value })
              }
              placeholder="Business card, cash…"
            />
          </Field>
          <Field label="Receipt / invoice number">
            <Input
              value={form.receipt_number}
              onChange={(event) =>
                setForm({ ...form, receipt_number: event.target.value })
              }
            />
          </Field>
          <Field label="Private receipt file">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={add.isPending} className="w-full">
              <Upload className="mr-1 h-4 w-4" />
              {add.isPending ? "Saving…" : "Save receipt"}
            </Button>
          </div>
        </form>

        {receipts.length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            No receipts yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {receipts.map((receipt: any) => (
              <div
                key={receipt.id}
                className="flex flex-wrap items-center gap-2 py-3 text-sm"
              >
                <Badge variant="outline" className="text-[10px] uppercase">
                  {receipt.category}
                </Badge>
                <span className="font-medium">
                  {receipt.vendor || "Unknown vendor"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {receipt.purchased_at} · {receipt.tax_category?.replaceAll("_", " ")}
                </span>
                <span className="ml-auto flex items-center gap-1 tabular-nums font-semibold">
                  <DollarSign className="h-3 w-3" />
                  {formatMoney(Number(receipt.amount))}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openReceipt(receipt)}
                >
                  <Eye className="mr-1 h-3 w-3" /> View
                </Button>
                {receipt.verified_at ? (
                  <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-900">
                    Verified
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verify.mutate(receipt)}
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" /> Verify
                  </Button>
                )}
                {receipt.job_cost_id ? (
                  <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-900">
                    In Job Costs
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pushToJobCost.mutate(receipt)}
                  >
                    <Link2 className="mr-1 h-3 w-3" /> Post cost
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={Boolean(receipt.job_cost_id)}
                  title={
                    receipt.job_cost_id
                      ? "Posted receipts are locked to preserve job-cost integrity."
                      : "Delete receipt"
                  }
                  onClick={() => remove.mutate(receipt)}
                >
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{formatMoney(value)}</div>
    </div>
  );
}
