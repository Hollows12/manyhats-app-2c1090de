type EntitlementContext = {
  supabase: unknown;
};

type EntitlementRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

export async function requireEntitlement(
  context: EntitlementContext,
  featureKey: string,
): Promise<void> {
  // The generated database types are updated only after migrations land.
  // Keep this one migration-ahead RPC isolated instead of weakening callers.
  const client = context.supabase as EntitlementRpcClient;
  const { data, error } = await client.rpc("has_entitlement", {
    _feature_key: featureKey,
  });
  if (error) {
    throw new Error(`Unable to verify feature access: ${error.message}`);
  }
  if (data !== true) {
    throw new Error(`Forbidden: ${featureKey} subscription required`);
  }
}
