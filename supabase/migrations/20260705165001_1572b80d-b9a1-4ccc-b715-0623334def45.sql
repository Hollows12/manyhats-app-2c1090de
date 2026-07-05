
CREATE OR REPLACE FUNCTION public.get_public_schema_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, information_schema
AS $$
  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_object_agg(table_name, cols) FROM (
        SELECT c.table_name, jsonb_agg(jsonb_build_object(
          'column', c.column_name,
          'type', c.data_type,
          'nullable', c.is_nullable,
          'default', c.column_default
        ) ORDER BY c.ordinal_position) AS cols
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        GROUP BY c.table_name
      ) t
    ),
    'indexes', (
      SELECT jsonb_object_agg(tablename || '.' || indexname, indexdef)
      FROM pg_indexes WHERE schemaname = 'public'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_schema_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_schema_snapshot() TO service_role;
