import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Phone, MapPin, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PROJECT_TYPE_LABEL,
  PROJECT_STATUS_OPTIONS,
  formatDate,
  formatMoney,
  HOME_TYPES,
  CONTAINER_TYPES,
  HISTORIC_TYPES,
  SEPTIC_TYPES,
} from "@/lib/manyhats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { ProjectFieldCapture } from "@/components/project/field-capture";
import { ProjectEstimate } from "@/components/project/estimate";
import { ProjectProposal } from "@/components/project/proposal";
import { ProjectConcepts } from "@/components/project/concepts";
import { ProjectJobMgmt } from "@/components/project/job-mgmt";
import { ProjectCosting } from "@/components/project/costing";
import { ProjectFinancial } from "@/components/project/financial";
import { ProjectVoiceNotes } from "@/components/project/voice-recorder";
import { ProjectReceipts } from "@/components/project/receipts";
import { ProjectDailyLog } from "@/components/project/daily-log";
import { ClientFileTab } from "@/components/project/client-file-tab";
import { ProjectPhases } from "@/components/project/phases";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const db = supabase as any;
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  const project = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name, phone, email)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Status updated.");
    },
  });

  const [overview, setOverview] = useState({
    summary: "",
    budget_min: "",
    budget_max: "",
    desired_timeline: "",
    site_notes: "",
    measurement_notes: "",
    client_goals: "",
    priorities: "",
    inclusions: "",
    exclusions: "",
    constraints: "",
    risks: "",
    warranty_expectations: "",
    jurisdiction_authority: "",
    code_notes: "",
    permit_requirements: "",
    inspection_requirements: "",
  });
  useEffect(() => {
    if (!project.data) return;
    const vision = (project.data as any).shared_vision ?? {};
    const jurisdiction = (project.data as any).jurisdiction_context ?? {};
    setOverview({
      summary: project.data.summary ?? "",
      budget_min: project.data.budget_min ? String(project.data.budget_min) : "",
      budget_max: project.data.budget_max ? String(project.data.budget_max) : "",
      desired_timeline: project.data.desired_timeline ?? "",
      site_notes: project.data.site_notes ?? "",
      measurement_notes: project.data.measurement_notes ?? "",
      client_goals: vision.client_goals ?? "",
      priorities: vision.priorities ?? "",
      inclusions: vision.inclusions ?? "",
      exclusions: vision.exclusions ?? "",
      constraints: vision.constraints ?? "",
      risks: vision.risks ?? "",
      warranty_expectations: vision.warranty_expectations ?? "",
      jurisdiction_authority: jurisdiction.authority ?? "",
      code_notes: jurisdiction.code_notes ?? "",
      permit_requirements: jurisdiction.permit_requirements ?? "",
      inspection_requirements: jurisdiction.inspection_requirements ?? "",
    });
  }, [project.data]);

  const saveOverview = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from("projects")
        .update({
          summary: overview.summary || null,
          budget_min: overview.budget_min ? Number(overview.budget_min) : null,
          budget_max: overview.budget_max ? Number(overview.budget_max) : null,
          desired_timeline: overview.desired_timeline || null,
          site_notes: overview.site_notes || null,
          measurement_notes: overview.measurement_notes || null,
          shared_vision: {
            client_goals: overview.client_goals,
            priorities: overview.priorities,
            inclusions: overview.inclusions,
            exclusions: overview.exclusions,
            constraints: overview.constraints,
            risks: overview.risks,
            warranty_expectations: overview.warranty_expectations,
          },
          jurisdiction_context: {
            authority: overview.jurisdiction_authority,
            code_notes: overview.code_notes,
            permit_requirements: overview.permit_requirements,
            inspection_requirements: overview.inspection_requirements,
          },
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Project overview saved.");
    },
    onError: (e) => toast.error(e.message),
  });

  if (project.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project.data) return <div className="p-8">Project not found.</div>;
  const p = project.data;

  const isHome = HOME_TYPES.has(p.project_type);
  const isContainer = CONTAINER_TYPES.has(p.project_type);
  const isHistoric = HISTORIC_TYPES.has(p.project_type);
  const isSeptic = SEPTIC_TYPES.has(p.project_type);
  const overviewDirty =
    overview.summary !== (p.summary ?? "") ||
    overview.budget_min !== (p.budget_min ? String(p.budget_min) : "") ||
    overview.budget_max !== (p.budget_max ? String(p.budget_max) : "") ||
    overview.desired_timeline !== (p.desired_timeline ?? "") ||
    overview.site_notes !== (p.site_notes ?? "") ||
    overview.measurement_notes !== (p.measurement_notes ?? "") ||
    overview.client_goals !== ((p as any).shared_vision?.client_goals ?? "") ||
    overview.priorities !== ((p as any).shared_vision?.priorities ?? "") ||
    overview.inclusions !== ((p as any).shared_vision?.inclusions ?? "") ||
    overview.exclusions !== ((p as any).shared_vision?.exclusions ?? "") ||
    overview.constraints !== ((p as any).shared_vision?.constraints ?? "") ||
    overview.risks !== ((p as any).shared_vision?.risks ?? "") ||
    overview.warranty_expectations !== ((p as any).shared_vision?.warranty_expectations ?? "") ||
    overview.jurisdiction_authority !== ((p as any).jurisdiction_context?.authority ?? "") ||
    overview.code_notes !== ((p as any).jurisdiction_context?.code_notes ?? "") ||
    overview.permit_requirements !== ((p as any).jurisdiction_context?.permit_requirements ?? "") ||
    overview.inspection_requirements !==
      ((p as any).jurisdiction_context?.inspection_requirements ?? "");

  return (
    <div className="space-y-6 p-4 md:p-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/projects">
          <ArrowLeft className="mr-1 h-3 w-3" /> All projects
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-gold text-gold-foreground bg-gold/10">
              {(p as any).project_subtype || PROJECT_TYPE_LABEL[p.project_type] || "Custom project"}
            </Badge>
            <StatusBadge status={p.status} />
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold">{p.name}</h1>
          <Link
            to="/clients/$id"
            params={{ id: p.clients.id }}
            className="text-sm text-muted-foreground hover:underline"
          >
            {p.clients.name}
          </Link>
          {p.summary && <p className="mt-3 max-w-2xl text-sm">{p.summary}</p>}
        </div>
        <div className="flex flex-col gap-2 lg:w-64 lg:items-end">
          <Select value={p.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-full lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <dl className="text-xs text-muted-foreground space-y-1 lg:text-right">
            {p.job_address && (
              <Row icon={MapPin}>{[p.job_address, p.city, p.state].filter(Boolean).join(", ")}</Row>
            )}
            {p.clients.phone && <Row icon={Phone}>{p.clients.phone}</Row>}
            {(p.budget_min || p.budget_max) && (
              <Row icon={DollarSign}>
                {formatMoney(p.budget_min)} – {formatMoney(p.budget_max)}
              </Row>
            )}
            {p.desired_timeline && <Row icon={Calendar}>{p.desired_timeline}</Row>}
          </dl>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="field">Field Capture</TabsTrigger>
          <TabsTrigger value="voice">Voice Notes</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="dailylog">Daily Log</TabsTrigger>
          <TabsTrigger value="estimate">Estimate</TabsTrigger>
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
          <TabsTrigger value="concept">Concept Studio</TabsTrigger>
          <TabsTrigger value="job">Job Management</TabsTrigger>
          <TabsTrigger value="costing">Job Costing</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="clientfile">Client File</TabsTrigger>
          {isHome && <TabsTrigger value="home">Home Builder</TabsTrigger>}

          {isContainer && <TabsTrigger value="container">Container Pro</TabsTrigger>}
          {isHistoric && <TabsTrigger value="historic">Historic Pro</TabsTrigger>}
          {isSeptic && <TabsTrigger value="septic">Septic Pro</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">Shared vision + site context</CardTitle>
              <Button
                size="sm"
                onClick={() => saveOverview.mutate()}
                disabled={!overviewDirty || saveOverview.isPending}
              >
                Save
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Project summary</Label>
                <Textarea
                  rows={3}
                  value={overview.summary}
                  onChange={(e) => setOverview({ ...overview, summary: e.target.value })}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Budget min</Label>
                  <Input
                    type="number"
                    value={overview.budget_min}
                    onChange={(e) => setOverview({ ...overview, budget_min: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Budget max</Label>
                  <Input
                    type="number"
                    value={overview.budget_max}
                    onChange={(e) => setOverview({ ...overview, budget_max: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Timeline</Label>
                  <Input
                    value={overview.desired_timeline}
                    onChange={(e) => setOverview({ ...overview, desired_timeline: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Site notes</Label>
                  <Textarea
                    rows={4}
                    value={overview.site_notes}
                    onChange={(e) => setOverview({ ...overview, site_notes: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Measurement notes</Label>
                  <Textarea
                    rows={4}
                    value={overview.measurement_notes}
                    onChange={(e) =>
                      setOverview({ ...overview, measurement_notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Client goals</Label>
                  <Textarea
                    rows={3}
                    value={overview.client_goals}
                    onChange={(e) => setOverview({ ...overview, client_goals: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priorities</Label>
                  <Textarea
                    rows={3}
                    value={overview.priorities}
                    onChange={(e) => setOverview({ ...overview, priorities: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inclusions</Label>
                  <Textarea
                    rows={3}
                    value={overview.inclusions}
                    onChange={(e) => setOverview({ ...overview, inclusions: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Exclusions</Label>
                  <Textarea
                    rows={3}
                    value={overview.exclusions}
                    onChange={(e) => setOverview({ ...overview, exclusions: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Constraints</Label>
                  <Textarea
                    rows={3}
                    value={overview.constraints}
                    onChange={(e) => setOverview({ ...overview, constraints: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Risks</Label>
                  <Textarea
                    rows={3}
                    value={overview.risks}
                    onChange={(e) => setOverview({ ...overview, risks: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Warranty expectations</Label>
                <Textarea
                  rows={2}
                  value={overview.warranty_expectations}
                  onChange={(e) =>
                    setOverview({ ...overview, warranty_expectations: e.target.value })
                  }
                />
              </div>
              <div className="rounded-md border p-3">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider">
                  Jurisdiction, code & inspections
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Authority / jurisdiction</Label>
                    <Input
                      value={overview.jurisdiction_authority}
                      onChange={(e) =>
                        setOverview({ ...overview, jurisdiction_authority: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Code notes and source</Label>
                    <Input
                      value={overview.code_notes}
                      onChange={(e) => setOverview({ ...overview, code_notes: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Permit requirements</Label>
                    <Textarea
                      rows={2}
                      value={overview.permit_requirements}
                      onChange={(e) =>
                        setOverview({ ...overview, permit_requirements: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Inspection requirements</Label>
                    <Textarea
                      rows={2}
                      value={overview.inspection_requirements}
                      onChange={(e) =>
                        setOverview({ ...overview, inspection_requirements: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="phases" className="mt-6">
          <ProjectPhases projectId={id} />
        </TabsContent>
        <TabsContent value="field" className="mt-6">
          <ProjectFieldCapture projectId={id} />
        </TabsContent>
        <TabsContent value="voice" className="mt-6">
          <ProjectVoiceNotes projectId={id} />
        </TabsContent>
        <TabsContent value="receipts" className="mt-6">
          <ProjectReceipts projectId={id} />
        </TabsContent>
        <TabsContent value="dailylog" className="mt-6">
          <ProjectDailyLog projectId={id} />
        </TabsContent>
        <TabsContent value="estimate" className="mt-6">
          <ProjectEstimate projectId={id} />
        </TabsContent>
        <TabsContent value="proposal" className="mt-6">
          <ProjectProposal projectId={id} />
        </TabsContent>
        <TabsContent value="concept" className="mt-6">
          <ProjectConcepts projectId={id} />
        </TabsContent>
        <TabsContent value="job" className="mt-6">
          <ProjectJobMgmt projectId={id} />
        </TabsContent>
        <TabsContent value="costing" className="mt-6">
          <ProjectCosting projectId={id} />
        </TabsContent>
        <TabsContent value="financial" className="mt-6">
          <ProjectFinancial projectId={id} />
        </TabsContent>
        <TabsContent value="clientfile" className="mt-6">
          <ClientFileTab projectId={id} />
        </TabsContent>

        {isHome && (
          <TabsContent value="home" className="mt-6">
            <SpecialtyPlaceholder name="Home Builder Pro" />
          </TabsContent>
        )}
        {isContainer && (
          <TabsContent value="container" className="mt-6">
            <SpecialtyPlaceholder name="Container Build Pro" />
          </TabsContent>
        )}
        {isHistoric && (
          <TabsContent value="historic" className="mt-6">
            <SpecialtyPlaceholder name="Historic Restoration Pro" />
          </TabsContent>
        )}
        {isSeptic && (
          <TabsContent value="septic" className="mt-6">
            <SpecialtyPlaceholder name="Sentinel Septic Pro" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 lg:justify-end">
      <Icon className="h-3 w-3" />
      {children}
    </div>
  );
}
function SpecialtyPlaceholder({ name }: { name: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">{name}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Specialty checklist, design fields, and selections center for this project type. Specific
        fields (foundation type, square footage, container size, sensor status, etc.) live in this
        tab and feed the proposal. We'll deepen this view in the next pass.
      </CardContent>
    </Card>
  );
}
