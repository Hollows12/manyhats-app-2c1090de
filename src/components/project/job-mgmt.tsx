import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/manyhats";

export function ProjectJobMgmt({ projectId }: { projectId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DailyLogs projectId={projectId} />
      <ChangeOrders projectId={projectId} />
    </div>
  );
}

function DailyLogs({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const logs = useQuery({
    queryKey: ["daily-logs", projectId],
    queryFn: async () => (await supabase.from("daily_logs").select("*").eq("project_id", projectId).order("log_date", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState({ weather: "", crew_notes: "", progress_notes: "", hours_worked: "" });
  const add = useMutation({
    mutationFn: async () => {
      await supabase.from("daily_logs").insert({
        project_id: projectId, ...form,
        hours_worked: form.hours_worked ? Number(form.hours_worked) : null,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["daily-logs", projectId] }); setForm({ weather: "", crew_notes: "", progress_notes: "", hours_worked: "" }); },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Daily logs</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-2 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Weather" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })}/>
            <Input type="number" step="0.25" placeholder="Hours" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: e.target.value })}/>
          </div>
          <Textarea rows={2} placeholder="Crew notes" value={form.crew_notes} onChange={(e) => setForm({ ...form, crew_notes: e.target.value })}/>
          <Textarea rows={2} placeholder="Progress notes" value={form.progress_notes} onChange={(e) => setForm({ ...form, progress_notes: e.target.value })}/>
          <Button type="submit" size="sm"><Plus className="mr-1 h-3 w-3"/>Add log</Button>
        </form>
        <div className="space-y-2">
          {(logs.data ?? []).map((l: any) => (
            <div key={l.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{formatDate(l.log_date)}</div>
                {l.hours_worked && <div className="text-xs text-muted-foreground">{l.hours_worked} hrs</div>}
              </div>
              {l.weather && <div className="text-xs text-muted-foreground">Weather: {l.weather}</div>}
              {l.progress_notes && <div className="mt-1 text-xs">{l.progress_notes}</div>}
            </div>
          ))}
          {(logs.data ?? []).length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No daily logs yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeOrders({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ["change-orders", projectId],
    queryFn: async () => (await supabase.from("change_orders").select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState({ description: "", reason: "", price_change: "", timeline_change_days: "" });
  const add = useMutation({
    mutationFn: async () => {
      await supabase.from("change_orders").insert({
        project_id: projectId,
        description: form.description, reason: form.reason,
        price_change: Number(form.price_change) || 0,
        timeline_change_days: Number(form.timeline_change_days) || 0,
        number: (orders.data?.length ?? 0) + 1,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["change-orders", projectId] }); setForm({ description: "", reason: "", price_change: "", timeline_change_days: "" }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("change_orders").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-orders", projectId] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Change orders</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-2 rounded-md border p-3">
          <Textarea rows={2} required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/>
          <Input placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}/>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Price change ($)" value={form.price_change} onChange={(e) => setForm({ ...form, price_change: e.target.value })}/>
            <Input type="number" placeholder="Timeline change (days)" value={form.timeline_change_days} onChange={(e) => setForm({ ...form, timeline_change_days: e.target.value })}/>
          </div>
          <Button type="submit" size="sm"><Plus className="mr-1 h-3 w-3"/>Add CO</Button>
        </form>
        <div className="space-y-2">
          {(orders.data ?? []).map((co: any) => (
            <div key={co.id} className="rounded-md border p-3 text-sm flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">CO #{co.number}</div>
                <div className="text-xs">{co.description}</div>
                {co.reason && <div className="text-xs text-muted-foreground mt-1">Reason: {co.reason}</div>}
                <div className="mt-1 text-xs">
                  <span className="font-semibold">${co.price_change}</span> · {co.timeline_change_days} days
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(co.id)}><Trash2 className="h-3 w-3"/></Button>
            </div>
          ))}
          {(orders.data ?? []).length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No change orders.</div>}
        </div>
      </CardContent>
    </Card>
  );
}
