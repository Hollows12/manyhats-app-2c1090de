create index if not exists idx_receipts_verified_by
on public.receipts (verified_by)
where verified_by is not null;
