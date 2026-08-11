import { describe, it, expect, vi, beforeAll } from "vitest";

// Stub env vars before the module is imported so createSupabaseClient does not throw.
vi.stubEnv("VITE_SUPABASE_URL", "https://stub.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "stub-anon-key");

// Mock @supabase/supabase-js so no real network calls are made.
const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: mockUnsubscribe } },
}));
const mockGetSession = vi.fn(async () => ({
  data: { session: null },
  error: null,
}));
const mockGetUser = vi.fn(async () => ({ data: { user: null }, error: null }));
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  })),
}));

// Dynamic import after stubs + mocks are in place.
let supabase: Awaited<typeof import("@/integrations/supabase/client")>["supabase"];
beforeAll(async () => {
  const mod = await import("@/integrations/supabase/client");
  supabase = mod.supabase;
});

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
