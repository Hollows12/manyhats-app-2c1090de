import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<"admin" | "crew" | "client" | null>(null);
  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data || data.length === 0) return setRole(null);
        // Highest privilege first
        if (data.some((r) => r.role === "admin")) return setRole("admin");
        if (data.some((r) => r.role === "crew")) return setRole("crew");
        return setRole("client");
      });
  }, [user]);
  return role;
}
