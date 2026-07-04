/**
 * End-to-end auth test: signup → email verification → confirmed session.
 *
 * Uses a real disposable inbox via MailSlurp so the confirmation email is
 * actually delivered, then extracts the verification token from the email
 * and confirms it against Supabase Auth.
 *
 * Skipped automatically when MAILSLURP_API_KEY is not set (local dev, PRs
 * from forks), so it never blocks the regular test run.
 *
 * Required env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY  (already used by CI)
 *   MAILSLURP_API_KEY                                  (add as GH Actions secret)
 */
import { describe, it, expect } from "vitest";
import { MailSlurp } from "mailslurp-client";
import { createClient } from "@supabase/supabase-js";

const apiKey = process.env.MAILSLURP_API_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const runOrSkip = apiKey && supabaseUrl && supabaseKey ? describe : describe.skip;

runOrSkip("auth E2E: signup → email confirmation → session", () => {
  // Each step (inbox creation, email delivery, token verify) can take time.
  const TEST_TIMEOUT = 120_000;

  it(
    "creates an account, confirms via emailed link, and produces a real session",
    async () => {
      const mailslurp = new MailSlurp({ apiKey: apiKey! });

      // Fresh Supabase client with its own in-memory storage so the test
      // never touches a real user's persisted session.
      const memoryStorage = new Map<string, string>();
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: false,
          storage: {
            getItem: (k) => memoryStorage.get(k) ?? null,
            setItem: (k, v) => void memoryStorage.set(k, v),
            removeItem: (k) => void memoryStorage.delete(k),
          },
        },
      });

      // 1. Provision a throwaway inbox.
      const inbox = await mailslurp.inboxController.createInboxWithDefaults();
      const email = inbox.emailAddress!;
      const password = `Test-${crypto.randomUUID()}-Aa1!`;

      try {
        // 2. Sign up. If the project requires email confirmation, session is null;
        //    if auto-confirm is on, we'll still verify the email round-trip below.
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: "E2E Test User" } },
        });
        expect(signUpError, signUpError?.message).toBeNull();
        expect(signUpData.user).toBeTruthy();
        expect(signUpData.user!.email).toBe(email);

        // 3. Wait for the confirmation email to arrive.
        const message = await mailslurp.waitForLatestEmail(inbox.id, 90_000, true);
        expect(message).toBeTruthy();
        const body = `${message.body ?? ""}\n${message.subject ?? ""}`;

        // 4. Extract the verification token. Supabase confirmation links look like:
        //    https://<project>.supabase.co/auth/v1/verify?token=<hash>&type=signup&redirect_to=...
        //    Newer templates may also expose ?token_hash=<hash>&type=email.
        const tokenMatch =
          body.match(/[?&](?:token_hash|token)=([A-Za-z0-9._-]+)/) ??
          body.match(/\/verify\?[^"'\s]*?(?:token_hash|token)=([A-Za-z0-9._-]+)/);
        const typeMatch = body.match(/[?&]type=(signup|email|magiclink|recovery|invite)/);
        expect(
          tokenMatch,
          "Could not find verification token in confirmation email",
        ).toBeTruthy();

        const tokenHash = tokenMatch![1];
        const type = (typeMatch?.[1] ?? "signup") as
          | "signup"
          | "email"
          | "magiclink"
          | "recovery"
          | "invite";

        // 5. Verify the token — this is exactly what clicking the link would do,
        //    without needing a browser.
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        expect(verifyError, verifyError?.message).toBeNull();
        expect(verifyData.session, "verifyOtp should return an authenticated session").toBeTruthy();
        expect(verifyData.user?.email_confirmed_at).toBeTruthy();

        // 6. Client must now report a live session.
        const { data: afterVerify } = await supabase.auth.getSession();
        expect(afterVerify.session).toBeTruthy();
        expect(afterVerify.session!.user.email).toBe(email);

        // 7. Sign out → session cleared.
        await supabase.auth.signOut();
        const { data: afterSignOut } = await supabase.auth.getSession();
        expect(afterSignOut.session).toBeNull();

        // 8. Sign back in with password → confirmed account works end-to-end.
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        expect(signInError, signInError?.message).toBeNull();
        expect(signInData.session).toBeTruthy();
        expect(signInData.user?.email_confirmed_at).toBeTruthy();

        await supabase.auth.signOut();
      } finally {
        // Always clean up the inbox to keep the MailSlurp account tidy.
        try {
          await mailslurp.inboxController.deleteInbox({ inboxId: inbox.id });
        } catch {
          /* ignore cleanup errors */
        }
      }
    },
    TEST_TIMEOUT,
  );
});
