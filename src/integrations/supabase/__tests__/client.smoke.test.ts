import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("supabase client smoke", () => {
  it("initializes with configured env vars", () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBeTruthy();
    expect(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
  });

  it("exposes an auth namespace with the expected methods", () => {
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.auth.getUser).toBe("function");
    expect(typeof supabase.auth.onAuthStateChange).toBe("function");
    expect(typeof supabase.auth.signInWithPassword).toBe("function");
    expect(typeof supabase.auth.signOut).toBe("function");
  });

  it("returns a session shape (null when unauthenticated) without throwing", async () => {
    const { data, error } = await supabase.auth.getSession();
    expect(error).toBeNull();
    expect(data).toHaveProperty("session");
    // In CI there is no user session; must be null, not undefined.
    expect(data.session).toBeNull();
  });

  it("registers and cleans up an auth state listener", () => {
    const { data } = supabase.auth.onAuthStateChange(() => {});
    expect(data.subscription).toBeDefined();
    expect(typeof data.subscription.unsubscribe).toBe("function");
    data.subscription.unsubscribe();
  });
});
