import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PHASE_STATUSES = [
  ["not_started", "Not started"],
  ["ready", "Ready"],
  ["in_progress", "In progress"],
  ["blocked", "Blocked"],
  ["complete", "Complete"],
  ["not_applicable", "Not applicable"],
] as const;

export function ProjectPhases({ projectId }: { projectId: string }) {
  const db = supabase as any;
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const phases = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await db
        .from("project_phases")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-phases", projectId] });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("project_phases").insert({
        project_id: projectId,
        name: name.trim(),
        trade: "custom",
        sort_order: ((phases.data?.length ?? 0) + 1) * 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Custom phase added.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Record<string, unknown> = { status };
      patch.completed_at = status === "complete" ? new Date().toISOString() : null;
      const { error } = await db.from("project_phases").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("project_phases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Project phases & checkpoints</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) add.mutate();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Add any custom phase"
          />
          <Button type="submit" disabled={!name.trim() || add.isPending}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </form>
        <div className="space-y-2">
          {(phases.data ?? []).map((phase: any) => (
            <div
              key={phase.id}
              className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{phase.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {phase.trade && <Badge variant="outline">{phase.trade}</Badge>}
                  {phase.permit_checkpoint && <Badge variant="secondary">Permit</Badge>}
                  {phase.inspection_checkpoint && <Badge variant="secondary">Inspection</Badge>}
                  {phase.professional_review && (
                    <Badge className="gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Professional review
                    </Badge>
                  )}
                </div>
              </div>
              <Select
                value={phase.status}
                onValueChange={(status) => update.mutate({ id: phase.id, status })}
              >
                <SelectTrigger className="w-full md:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASE_STATUSES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${phase.name}`}
                onClick={() => remove.mutate(phase.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!phases.isLoading && (phases.data ?? []).length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No phases yet. Add a custom phase or apply a workflow template.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
