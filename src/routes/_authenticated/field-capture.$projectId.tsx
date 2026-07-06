import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, Mic, Receipt, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectFieldCapture } from "@/components/project/field-capture";
import { ProjectVoiceNotes } from "@/components/project/voice-recorder";
import { ProjectReceipts } from "@/components/project/receipts";
import { ProjectDailyLog } from "@/components/project/daily-log";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/field-capture/$projectId")({
  component: FieldCaptureProject,
});

function FieldCaptureProject() {
  const { projectId } = Route.useParams();
  const project = useQuery({
    queryKey: ["fc-project", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, job_address, city, state, clients(name)")
        .eq("id", projectId)
        .single();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/field-capture">
            <ArrowLeft className="mr-1 h-3 w-3" /> Field capture
          </Link>
        </Button>
        <div className="mt-1">
          <div className="truncate font-display text-lg font-bold">
            {project.data?.name ?? "Loading…"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {(project.data as any)?.clients?.name}
            {project.data?.job_address ? ` · ${project.data.job_address}` : ""}
          </div>
        </div>
      </div>

      <div className="px-3 pt-3">
        <Tabs defaultValue="photos">
          <TabsList className="grid w-full grid-cols-4 gap-1">
            <TabsTrigger value="photos" className="flex-col gap-0.5 py-2 text-[10px]">
              <Camera className="h-4 w-4" /> Photos
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex-col gap-0.5 py-2 text-[10px]">
              <Mic className="h-4 w-4" /> Voice
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex-col gap-0.5 py-2 text-[10px]">
              <Receipt className="h-4 w-4" /> Receipts
            </TabsTrigger>
            <TabsTrigger value="log" className="flex-col gap-0.5 py-2 text-[10px]">
              <ClipboardList className="h-4 w-4" /> Log
            </TabsTrigger>
          </TabsList>
          <TabsContent value="photos" className="mt-3">
            <ProjectFieldCapture projectId={projectId} />
          </TabsContent>
          <TabsContent value="voice" className="mt-3">
            <ProjectVoiceNotes projectId={projectId} />
          </TabsContent>
          <TabsContent value="receipts" className="mt-3">
            <ProjectReceipts projectId={projectId} />
          </TabsContent>
          <TabsContent value="log" className="mt-3">
            <ProjectDailyLog projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _empty = { Card, CardContent };
