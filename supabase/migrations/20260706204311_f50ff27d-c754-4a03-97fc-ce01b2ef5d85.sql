
REVOKE EXECUTE ON FUNCTION public.create_client_file_share(uuid, text, int, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rotate_client_file_share_pin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_client_file_share(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_client_file_share(uuid, text, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_client_file_share_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_client_file_share(uuid) TO authenticated;
