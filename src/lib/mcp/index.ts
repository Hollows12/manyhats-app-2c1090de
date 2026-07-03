import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import listClients from "./tools/list-clients";
import getProject from "./tools/get-project";
import createLead from "./tools/create-lead";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "manyhats-pro-mcp",
  title: "ManyHats Pro",
  version: "0.1.0",
  instructions:
    "Tools for ManyHats Construction's contractor operating system. Use list_projects and list_clients to browse the pipeline, get_project for details, and create_lead to add new CRM records. All calls run as the signed-in user with RLS enforced.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, listClients, getProject, createLead],
});
