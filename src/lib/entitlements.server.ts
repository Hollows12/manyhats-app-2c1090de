type EntitlementContext = {
  supabase: {
    rpc: (
      functionName: "has_entitlement",
      args: { _feature_key: string },
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
};

export async function requireEntitlement(
  context: EntitlementContext,
  featureKey: string,
): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_entitlement", {
    _feature_key: featureKey,
  });
  if (error) {
    throw new Error(`Unable to verify feature access: ${error.message}`);
  }
  if (data !== true) {
    throw new Error(`Forbidden: ${featureKey} subscription required`);
  }
}
