import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Trash2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = {
  log_date: new Date().toISOString().slice(0, 10),
  weather: "",
  crew_notes: "",
  material_notes: "",
  equipment_notes: "",
  subcontractor_notes: "",
  progress_notes: "",
  client_communication: "",
  hours_worked: "",
};

export function ProjectDailyLog({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const logs = useQuery({
    queryKey: ["daily-logs", projectId],
    queryFn: async () =>
      (
        await supabase
          .from("daily_logs")
          .select("*")
          .eq("project_id", projectId)
          .order("log_date", { ascending: false })
      ).data ?? [],
  });

  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_logs").insert({
        project_id: projectId,
        log_date: form.log_date,
        weather: form.weather || null,
        crew_notes: form.crew_notes || null,
        material_notes: form.material_notes || null,
        equipment_notes: form.equipment_notes || null,
        subcontractor_notes: form.subcontractor_notes || null,
        progress_notes: form.progress_notes || null,
        client_communication: form.client_communication || null,
        hours_worked: form.hours_worked ? Number(form.hours_worked) : null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-logs", projectId] });
      setForm(EMPTY);
      setOpen(false);
      toast.success("Daily log saved.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("daily_logs").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-logs", projectId] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="font-display flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-gold" />
            Daily field log
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Weather, crew, materials, progress — a signed record of what happened on the site each day.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "New log"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
            className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-2"
          >
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                required
                value={form.log_date}
                onChange={(e) => setForm({ ...form, log_date: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Weather</Label>
              <Input
                value={form.weather}
                onChange={(e) => setForm({ ...form, weather: e.target.value })}
                placeholder="e.g. 68°F, light rain"
              />
            </div>
            <div>
              <Label className="text-xs">Hours worked</Label>
              <Input
                type="number"
                step="0.25"
                value={form.hours_worked}
                onChange={(e) => setForm({ ...form, hours_worked: e.target.value })}
              />
            </div>
            <TextRow label="Crew / who worked" value={form.crew_notes} onChange={(v) => setForm({ ...form, crew_notes: v })} />
            <TextRow label="Materials delivered / used" value={form.material_notes} onChange={(v) => setForm({ ...form, material_notes: v })} />
            <TextRow label="Equipment used" value={form.equipment_notes} onChange={(v) => setForm({ ...form, equipment_notes: v })} />
            <TextRow label="Subcontractors" value={form.subcontractor_notes} onChange={(v) => setForm({ ...form, subcontractor_notes: v })} />
            <TextRow label="Progress / work completed" value={form.progress_notes} onChange={(v) => setForm({ ...form, progress_notes: v })} full />
            <TextRow label="Client communication / change orders" value={form.client_communication} onChange={(v) => setForm({ ...form, client_communication: v })} full />
            <div className="md:col-span-2">
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? "Saving…" : "Save log"}
              </Button>
            </div>
          </form>
        )}

        {(logs.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            No daily logs yet.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.data!.map((l: any) => (
              <div key={l.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-gold" />
                    <span className="font-semibold">{l.log_date}</span>
                    {l.weather && <span className="text-xs text-muted-foreground">· {l.weather}</span>}
                    {l.hours_worked != null && <span className="text-xs text-muted-foreground">· {l.hours_worked}h</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(l.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-2 grid gap-1 text-xs">
                  {l.progress_notes && <LogLine label="Progress">{l.progress_notes}</LogLine>}
                  {l.crew_notes && <LogLine label="Crew">{l.crew_notes}</LogLine>}
                  {l.material_notes && <LogLine label="Materials">{l.material_notes}</LogLine>}
                  {l.equipment_notes && <LogLine label="Equipment">{l.equipment_notes}</LogLine>}
                  {l.subcontractor_notes && <LogLine label="Subs">{l.subcontractor_notes}</LogLine>}
                  {l.client_communication && <LogLine label="Client">{l.client_communication}</LogLine>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TextRow({ label, value, onChange, full }: { label: string; value: string; onChange: (v: string) => void; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LogLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap">{children}</span>
    </div>
  );
}
