import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandMark } from "@/components/brand-mark";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { COMPANY } from "@/lib/manyhats";
import logoAsset from "@/assets/manyhats-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ invite: typeof s.invite === "string" ? s.invite : undefined }),
  head: () => ({
    meta: [
      { title: "Sign in — ManyHats Pro" },
      { name: "description", content: "Sign in to your ManyHats Pro contractor dashboard." },
    ],
  }),
  component: AuthPage,
});

type InvitePreview = { email: string; role: "admin" | "crew"; expires_at: string; accepted_at: string | null };

function AuthPage() {
  const navigate = useNavigate();
  const { invite } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(invite ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [bootstrapAllowed, setBootstrapAllowed] = useState(false);

  useEffect(() => {
    if (!invite) {
      supabase.rpc("can_bootstrap_owner").then(({ data }) => setBootstrapAllowed(data === true));
      return;
    }
    supabase.rpc("get_invitation_preview", { _token: invite }).then(({ data, error }) => {
      if (error || !data) {
        setInviteError("This invitation link is invalid.");
        return;
      }
      const preview = data as unknown as InvitePreview;
      if (preview.accepted_at) { setInviteError("This invitation has already been accepted."); return; }
      if (new Date(preview.expires_at) < new Date()) { setInviteError("This invitation has expired."); return; }
      setInvitePreview(preview);
      setEmail(preview.email);
    });
  }, [invite]);

  async function acceptIfInvited() {
    if (!invite) return;
    const { error } = await supabase.rpc("accept_invitation", { _token: invite });
    if (error) throw new Error(error.message || "Could not accept invitation");
    toast.success("Invitation accepted.");
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      try {
        if (invite) await acceptIfInvited();
        navigate({ to: "/dashboard", replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not accept invitation";
        setInviteError(message);
        toast.error(message);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      } else {
        if (!invite && !bootstrapAllowed) {
          throw new Error("A valid team invitation is required to create an account.");
        }
        if (invite && (!invitePreview || inviteError)) {
          throw new Error(inviteError || "Invitation validation is still in progress.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, ...(invite ? { invite_token: invite } : {}) },
            emailRedirectTo: `${window.location.origin}/auth${invite ? `?invite=${invite}` : ""}`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to confirm your account.");
          return;
        }
        toast.success("Account created.");
      }
      await acceptIfInvited();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent. Check your inbox.");
      setTab("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }


  async function handleGoogle() {
    setBusy(true);
    try {
      const redirect = `${window.location.origin}${invite ? `/auth?invite=${invite}` : ""}`;
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirect });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      await acceptIfInvited();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-navy-gradient p-12 text-ivory lg:flex lg:flex-col lg:justify-between">
        <BrandMark className="[&_.font-display]:text-white [&_.text-muted-foreground]:text-gold/70" />
        <div className="flex flex-col items-start gap-8">
          <img src={logoAsset.url} alt="ManyHats Pro shield" className="h-40 w-40 object-contain drop-shadow-[0_8px_32px_rgba(212,175,55,0.35)]" />
          <div>
            <h2 className="font-display text-4xl font-semibold leading-tight">
              From lead to closeout — every project, one source of truth.
            </h2>
            <p className="mt-4 text-ivory/70">
              Field capture. Estimates with line-item costing. Proposals with Good / Better / Best.
              Concept studio for client-facing renderings. Job costing that improves your next bid.
            </p>
          </div>
        </div>
        <div className="text-xs text-ivory/60">
          {COMPANY.owner} · {COMPANY.ownerTitle} · {COMPANY.phone}
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Welcome to ManyHats Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage leads, jobs, and proposals.
            </p>
          </div>

          {invite && (invitePreview || inviteError) && (
            <div className={`rounded-md border p-3 text-sm ${inviteError ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-gold/40 bg-gold/10"}`}>
              <div className="flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4" />
                {inviteError ? "Invitation unavailable" : "You've been invited"}
              </div>
              {invitePreview && !inviteError && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Create an account for <span className="font-semibold text-foreground">{invitePreview.email}</span> to join as <span className="font-semibold capitalize text-foreground">{invitePreview.role}</span>.
                </p>
              )}
              {inviteError && <p className="mt-1 text-xs">{inviteError}</p>}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={busy || Boolean(invite && inviteError)}
          >
            <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1A6.61 6.61 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup" | "forgot")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              {tab === "forgot" ? (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Reset your password</h2>
                    <p className="text-xs text-muted-foreground">Enter the email on your account and we'll send a reset link.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                  </Button>
                  <button type="button" className="w-full text-xs text-muted-foreground hover:underline" onClick={() => setTab("signin")}>
                    ← Back to sign in
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmail} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => setTab("forgot")}>
                        Forgot password?
                      </button>
                    </div>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="ml-1 h-4 w-4" /></>}
                  </Button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(invitePreview)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy || Boolean(invite && (!invitePreview || inviteError)) || (!invite && !bootstrapAllowed)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {bootstrapAllowed && !invite
                    ? "This first account becomes the owner administrator."
                    : invite
                      ? "Your verified invitation assigns your approved team role."
                      : "New accounts require an invitation from an administrator."}
                </p>
              </form>
            </TabsContent>
          </Tabs>


          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back to home</Link>
            <span className="mx-2">·</span>
            <Link to="/email-help" className="hover:underline">Didn't get the email?</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
