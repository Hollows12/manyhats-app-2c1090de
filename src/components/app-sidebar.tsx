import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Inbox, Users, Briefcase, Camera, Calculator, FileText,
  Sparkles, Home, Container, Landmark, Droplets, ClipboardList, TrendingUp,
  BookOpen, Settings, LogOut, Phone, DollarSign, UserPlus, Receipt, Wallet,
  ShieldAlert, GitBranch, FolderLock,
} from "lucide-react";
import { useRole } from "@/hooks/use-auth";





import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/brand-mark";
import { COMPANY } from "@/lib/manyhats";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

const PIPELINE = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Inbox },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Projects", url: "/projects", icon: Briefcase },
  { title: "Field Capture", url: "/field-capture", icon: Camera },
];
const BUILD = [
  { title: "Estimates", url: "/estimates", icon: Calculator },
  { title: "Proposals", url: "/proposals", icon: FileText },
  { title: "Concept Studio", url: "/concept-studio", icon: Sparkles },
];
const FINANCIAL = [
  { title: "Invoices", url: "/invoices", icon: Receipt },
  { title: "Payments", url: "/payments", icon: Wallet },
  { title: "Job Costing", url: "/job-costing", icon: TrendingUp },
];
const PRO = [
  { title: "Home Builder Pro", url: "/home-builder", icon: Home },
  { title: "Container Build Pro", url: "/container-builds", icon: Container },
  { title: "Historic Pro", url: "/historic", icon: Landmark },
  { title: "Sentinel Septic Pro", url: "/septic", icon: Droplets },
];
const OPS = [
  { title: "Smart Pricing", url: "/pricing", icon: DollarSign },
  { title: "Job Management", url: "/job-management", icon: ClipboardList },
  { title: "Knowledge Base", url: "/knowledge-base", icon: BookOpen },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useRole();


  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const renderGroup = (label: string, items: typeof PIPELINE) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60 text-[10px] uppercase tracking-[0.15em]">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/40 px-4 py-4">
        {collapsed ? (
          <BrandMark hideTagline className="[&_.font-display]:hidden" />
        ) : (
          <BrandMark />
        )}
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Pipeline", PIPELINE)}
        {renderGroup("Estimating & Proposals", BUILD)}
        {renderGroup("Financial", FINANCIAL)}
        {renderGroup("Pro Modules", PRO)}
        {renderGroup("Operations", OPS)}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/team")} tooltip="Team">
                  <Link to="/team" className="flex items-center gap-3">
                    <UserPlus className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Team</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Settings">
                  <Link to="/settings" className="flex items-center gap-3">
                    <Settings className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Settings</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {role === "admin" && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/admin/logs")} tooltip="Admin logs">
                      <Link to="/admin/logs" className="flex items-center gap-3">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-gold" />
                        {!collapsed && <span>Admin logs</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/admin/git-sync")} tooltip="Git sync">
                      <Link to="/admin/git-sync" className="flex items-center gap-3">
                        <GitBranch className="h-4 w-4 shrink-0 text-gold" />
                        {!collapsed && <span>Git sync</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/40 px-3 py-3">
        {!collapsed && (
          <div className="mb-2 rounded-md bg-sidebar-accent/40 px-3 py-2 text-[11px] leading-snug text-sidebar-foreground/80">
            <div className="font-semibold text-gold">{COMPANY.owner}</div>
            <div className="text-sidebar-foreground/60">{COMPANY.ownerTitle}</div>
            <div className="mt-1 flex items-center gap-1">
              <Phone className="h-3 w-3" /> {COMPANY.phone}
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sign out">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
