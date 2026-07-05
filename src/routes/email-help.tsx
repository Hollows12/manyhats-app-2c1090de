import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Copy, Loader2, Mail, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/email-help")({
  head: () => ({
    meta: [
      { title: "Email not arriving? — ManyHats Pro" },
      {
        name: "description",
        content:
          "Troubleshoot missing Outlook, Hotmail, and Live verification emails. Resend confirmation with timestamps and request IDs for support.",
      },
      { property: "og:title", content: "Email verification troubleshooting" },
      {
        property: "og:description",
        content:
          "Why Outlook verification emails may not arrive and how to resend them with a trackable request ID.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: EmailHelpPage,
});

type Attempt = {
  requestId: string;
  email: string;
  timestampISO: string;
  timestampLabel: string;
  status: "sent" | "failed";
  message: string;
};

const OUTLOOK_DOMAINS = ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.", "hotmail."];

function makeRequestId() {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `req_${stamp}_${rand}`.toLowerCase();
}

const STORAGE_KEY = "manyhats.emailHelp.resendAttempts.v1";
const MAX_ATTEMPTS = 10;


function EmailHelpPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setAttempts(parsed.slice(0, MAX_ATTEMPTS));
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    } catch {
      // storage full or unavailable
    }
  }, [attempts, hydrated]);

  const isOutlookish = OUTLOOK_DOMAINS.some((d) => email.toLowerCase().includes(d));

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    const requestId = makeRequestId();
    const now = new Date();
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      const attempt: Attempt = {
        requestId,
        email,
        timestampISO: now.toISOString(),
        timestampLabel: now.toLocaleString(),
        status: error ? "failed" : "sent",
        message: error ? error.message : "Verification email requeued.",
      };
      setAttempts((prev) => [attempt, ...prev].slice(0, 10));
      if (error) toast.error(error.message);
      else toast.success(`Resent. Request ID ${requestId}`);
    } catch (err) {
      const attempt: Attempt = {
        requestId,
        email,
        timestampISO: now.toISOString(),
        timestampLabel: now.toLocaleString(),
        status: "failed",
        message: err instanceof Error ? err.message : "Unknown error",
      };
      setAttempts((prev) => [attempt, ...prev].slice(0, 10));
      toast.error("Resend failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <header className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Email delivery help
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">
            Verification email not arriving?
          </h1>
          <p className="mt-2 text-muted-foreground">
            Outlook, Hotmail, and Live inboxes are the most common place messages go missing.
            Here's how to find them — and if you still can't, resend a fresh one below with a
            request ID our team can look up.
          </p>
        </header>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" /> Resend verification email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResend} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@outlook.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {isOutlookish && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-gold" />
                    Microsoft inbox detected — please also check the <strong>Junk Email</strong> and{" "}
                    <strong>Other</strong> tabs after resending.
                  </p>
                )}
              </div>
              <Button type="submit" disabled={busy || !email}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                  </>
                ) : (
                  <>Resend verification email</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {attempts.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Recent resend attempts
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {attempts.map((a) => (
                <div key={a.requestId} className="flex flex-col gap-2 py-3 text-sm md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {a.status === "sent" ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" /> Failed
                        </Badge>
                      )}
                      <span className="font-medium">{a.email}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.timestampLabel} · <span title={a.timestampISO}>{a.timestampISO}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{a.message}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs">{a.requestId}</code>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(`${a.requestId} | ${a.email} | ${a.timestampISO}`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="pt-3 text-xs text-muted-foreground">
                Include the request ID and timestamp when contacting support — it lets us find your
                exact send in the mail logs.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold">Common reasons Outlook emails don't arrive</h2>
          <Accordion type="multiple" className="mt-3">
            <AccordionItem value="junk">
              <AccordionTrigger>1. It's in Junk Email or the "Other" focused-inbox tab</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Outlook.com and the Outlook desktop app split mail into <strong>Focused</strong> and{" "}
                  <strong>Other</strong>. Automated verification emails frequently land in{" "}
                  <strong>Other</strong> or <strong>Junk Email</strong>.
                </p>
                <p>Check both, and mark the message as "Not junk" to whitelist future sends.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="delay">
              <AccordionTrigger>2. Microsoft is greylisting or delaying delivery</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Microsoft frequently delays first-time mail from a new sender by 5–15 minutes as an
                anti-spam measure. Wait a few minutes before resending, then resend at most once
                more. Repeated resends can trigger rate limits and delay things further.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="alias">
              <AccordionTrigger>3. You signed up with an alias or plus-address</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Outlook supports aliases like <code>you+work@outlook.com</code>. Some corporate
                tenants strip the "+" segment or route aliases to a different mailbox. Try
                resending to the exact address on your account instead.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="tenant">
              <AccordionTrigger>4. Your company's Microsoft 365 tenant is blocking us</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Microsoft 365 admins can quarantine mail from unknown senders. Ask your IT team
                  to check the <strong>Microsoft Defender quarantine</strong> and safelist the
                  sender domain.
                </p>
                <p>Share the request ID from the resend log so IT can match it to their logs.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="typo">
              <AccordionTrigger>5. Typo in the email address</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <code>outllok.com</code>, <code>hotmial.com</code>, and <code>hotamail.com</code>{" "}
                are the most common typos we see. Double-check the address, then resend to the
                corrected version.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="full">
              <AccordionTrigger>6. Mailbox is full or the account is suspended</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Free Outlook accounts that go unused for 12+ months are deactivated. A full mailbox
                also bounces incoming mail. Sign in at outlook.com to confirm the mailbox is
                healthy.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="already">
              <AccordionTrigger>7. The account is already verified</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                If you've clicked a previous link, no new email will be sent. Try signing in
                directly at the <Link to="/auth" className="underline">sign in page</Link>.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="mt-10 rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-semibold">Still stuck?</p>
          <p className="mt-1 text-muted-foreground">
            Copy the most recent request ID above and reply to your onboarding thread, or reach
            out from the sign-in page. We can trace the exact send timestamp and delivery
            response on our side.
          </p>
        </div>
      </div>
    </div>
  );
}
