import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Phone, Mail, MapPin, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (vals: any) => {
      const { error } = await supabase.from("clients").insert(vals);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Client added."); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (clients.data ?? []).filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search),
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">Customer records and project history.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" /> New client</Button>
            </DialogTrigger>
            <ClientDialog onSubmit={(v) => create.mutate(v)} busy={create.isPending} />
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No matches" : "No clients yet"}
          description={search ? "Try a different search." : "Add your first client to start a project."}
          action={!search && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New client</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c: any) => (
            <Link key={c.id} to="/clients/$id" params={{ id: c.id }}>
              <Card className="transition-all hover:border-gold hover:shadow-md">
                <CardContent className="p-5">
                  <div className="font-display text-lg font-semibold">{c.name}</div>
                  <dl className="mt-3 space-y-1 text-sm">
                    {c.phone && <Row icon={Phone}>{c.phone}</Row>}
                    {c.email && <Row icon={Mail}>{c.email}</Row>}
                    {(c.city || c.state) && <Row icon={MapPin}>{[c.city, c.state, c.zip].filter(Boolean).join(", ")}</Row>}
                  </dl>
                  <div className="mt-3 text-xs text-muted-foreground">Updated {formatDate(c.updated_at)}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function ClientDialog({ onSubmit, busy }: { onSubmit: (v: any) => void; busy: boolean }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", state: "", zip: "", county: "", notes: "" });
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      >
        <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        </div>
        <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="grid grid-cols-4 gap-3">
          <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="State"><Input value={form.state} maxLength={2} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
          <Field label="ZIP"><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></Field>
          <Field label="County"><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></Field>
        <DialogFooter>
          <Button type="submit" disabled={busy}>Save client</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
