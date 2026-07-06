import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Phone, MapPin, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PROJECT_TYPE_LABEL, PROJECT_STATUS_OPTIONS, formatDate, formatMoney,
  HOME_TYPES, CONTAINER_TYPES, HISTORIC_TYPES, SEPTIC_TYPES,
} from "@/lib/manyhats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { ProjectFieldCapture } from "@/components/project/field-capture";
import { ProjectEstimate } from "@/components/project/estimate";
import { ProjectProposal } from "@/components/project/proposal";
import { ProjectConcepts } from "@/components/project/concepts";
import { ProjectJobMgmt } from "@/components/project/job-mgmt";
import { ProjectCosting } from "@/components/project/costing";
import { ProjectFinancial } from "@/components/project/financial";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  const project = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("*, clients(id, name, phone, email)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("projects").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); toast.success("Status updated."); },
  });

  if (project.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project.data) return <div className="p-8">Project not found.</div>;
  const p = project.data;

  const isHome = HOME_TYPES.has(p.project_type);
  const isContainer = CONTAINER_TYPES.has(p.project_type);
  const isHistoric = HISTORIC_TYPES.has(p.project_type);
  const isSeptic = SEPTIC_TYPES.has(p.project_type);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/projects"><ArrowLeft className="mr-1 h-3 w-3"/> All projects</Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-gold text-gold-foreground bg-gold/10">{PROJECT_TYPE_LABEL[p.project_type]}</Badge>
            <StatusBadge status={p.status} />
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold">{p.name}</h1>
          <Link to="/clients/$id" params={{ id: p.clients.id }} className="text-sm text-muted-foreground hover:underline">
            {p.clients.name}
          </Link>
          {p.summary && <p className="mt-3 max-w-2xl text-sm">{p.summary}</p>}
        </div>
        <div className="flex flex-col gap-2 lg:w-64 lg:items-end">
          <Select value={p.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-full lg:w-56"><SelectValue/></SelectTrigger>
            <SelectContent>
              {PROJECT_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <dl className="text-xs text-muted-foreground space-y-1 lg:text-right">
            {p.job_address && <Row icon={MapPin}>{[p.job_address, p.city, p.state].filter(Boolean).join(", ")}</Row>}
            {p.clients.phone && <Row icon={Phone}>{p.clients.phone}</Row>}
            {(p.budget_min || p.budget_max) && <Row icon={DollarSign}>{formatMoney(p.budget_min)} – {formatMoney(p.budget_max)}</Row>}
            {p.desired_timeline && <Row icon={Calendar}>{p.desired_timeline}</Row>}
          </dl>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="field">Field Capture</TabsTrigger>
          <TabsTrigger value="estimate">Estimate</TabsTrigger>
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
          <TabsTrigger value="concept">Concept Studio</TabsTrigger>
          <TabsTrigger value="job">Job Management</TabsTrigger>
          <TabsTrigger value="costing">Job Costing</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          {isHome && <TabsTrigger value="home">Home Builder</TabsTrigger>}
          {isContainer && <TabsTrigger value="container">Container Pro</TabsTrigger>}
          {isHistoric && <TabsTrigger value="historic">Historic Pro</TabsTrigger>}
          {isSeptic && <TabsTrigger value="septic">Septic Pro</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Site notes" content={p.site_notes} />
            <InfoCard title="Measurement notes" content={p.measurement_notes} />
          </div>
        </TabsContent>
        <TabsContent value="field" className="mt-6"><ProjectFieldCapture projectId={id} /></TabsContent>
        <TabsContent value="estimate" className="mt-6"><ProjectEstimate projectId={id} /></TabsContent>
        <TabsContent value="proposal" className="mt-6"><ProjectProposal projectId={id} /></TabsContent>
        <TabsContent value="concept" className="mt-6"><ProjectConcepts projectId={id} /></TabsContent>
        <TabsContent value="job" className="mt-6"><ProjectJobMgmt projectId={id} /></TabsContent>
        <TabsContent value="costing" className="mt-6"><ProjectCosting projectId={id} /></TabsContent>
        <TabsContent value="financial" className="mt-6"><ProjectFinancial projectId={id} /></TabsContent>
        {isHome && <TabsContent value="home" className="mt-6"><SpecialtyPlaceholder name="Home Builder Pro" /></TabsContent>}
        {isContainer && <TabsContent value="container" className="mt-6"><SpecialtyPlaceholder name="Container Build Pro" /></TabsContent>}
        {isHistoric && <TabsContent value="historic" className="mt-6"><SpecialtyPlaceholder name="Historic Restoration Pro" /></TabsContent>}
        {isSeptic && <TabsContent value="septic" className="mt-6"><SpecialtyPlaceholder name="Sentinel Septic Pro" /></TabsContent>}
      </Tabs>
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 lg:justify-end"><Icon className="h-3 w-3"/>{children}</div>;
}
function InfoCard({ title, content }: { title: string; content?: string | null }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
        {content || "—"}
      </CardContent>
    </Card>
  );
}
function SpecialtyPlaceholder({ name }: { name: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-display">{name}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Specialty checklist, design fields, and selections center for this project type. Specific fields (foundation type, square footage, container size, sensor status, etc.) live in this tab and feed the proposal. We'll deepen this view in the next pass.
      </CardContent>
    </Card>
  );
}
