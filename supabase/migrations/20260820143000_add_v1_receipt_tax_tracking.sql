alter table public.receipts
  add column if not exists subtotal numeric not null default 0,
  add column if not exists sales_tax numeric not null default 0,
  add column if not exists deductible_pct numeric not null default 100,
  add column if not exists tax_category text not null default 'job_materials',
  add column if not exists payment_method text,
  add column if not exists receipt_number text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

alter table public.receipts
  drop constraint if exists receipts_amount_nonnegative,
  add constraint receipts_amount_nonnegative check (amount >= 0),
  drop constraint if exists receipts_subtotal_nonnegative,
  add constraint receipts_subtotal_nonnegative check (subtotal >= 0),
  drop constraint if exists receipts_sales_tax_nonnegative,
  add constraint receipts_sales_tax_nonnegative check (sales_tax >= 0),
  drop constraint if exists receipts_deductible_pct_range,
  add constraint receipts_deductible_pct_range check (deductible_pct between 0 and 100),
  drop constraint if exists receipts_amount_breakdown,
  add constraint receipts_amount_breakdown check (amount >= subtotal + sales_tax);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  15728640,
  array['image/jpeg','image/png','image/heic','image/heif','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff read receipt files" on storage.objects;
create policy "Staff read receipt files"
on storage.objects for select to authenticated
using (bucket_id = 'receipts' and public.is_staff((select auth.uid())));

drop policy if exists "Staff upload receipt files" on storage.objects;
create policy "Staff upload receipt files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts'
  and public.is_staff((select auth.uid()))
  and (storage.foldername(name))[1] is not null
);

drop policy if exists "Staff update receipt files" on storage.objects;
create policy "Staff update receipt files"
on storage.objects for update to authenticated
using (bucket_id = 'receipts' and public.is_staff((select auth.uid())))
with check (bucket_id = 'receipts' and public.is_staff((select auth.uid())));

drop policy if exists "Staff delete receipt files" on storage.objects;
create policy "Staff delete receipt files"
on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and public.is_staff((select auth.uid())));

create or replace function public.post_receipt_to_job_cost(_receipt_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_receipt public.receipts%rowtype;
  v_category public.estimate_category;
  v_job_cost_id uuid;
begin
  if (select auth.uid()) is null
     or not public.is_staff((select auth.uid())) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  select * into v_receipt
  from public.receipts
  where id = _receipt_id
  for update;

  if not found then
    raise exception 'Receipt not found or unavailable' using errcode = 'P0002';
  end if;

  if v_receipt.job_cost_id is not null then
    return v_receipt.job_cost_id;
  end if;

  v_category := case v_receipt.category
    when 'material' then 'material'::public.estimate_category
    when 'equipment' then 'equipment'::public.estimate_category
    when 'fuel' then 'fuel_travel'::public.estimate_category
    when 'subcontractor' then 'subcontractor'::public.estimate_category
    else 'other'::public.estimate_category
  end;

  insert into public.job_costs (project_id, category, estimated, actual, notes)
  values (
    v_receipt.project_id,
    v_category,
    0,
    v_receipt.amount,
    'Receipt-backed actual cost'
  )
  on conflict (project_id, category) do update
  set actual = public.job_costs.actual + excluded.actual,
      updated_at = now()
  returning id into v_job_cost_id;

  update public.receipts
  set job_cost_id = v_job_cost_id,
      updated_at = now()
  where id = v_receipt.id;

  return v_job_cost_id;
end;
$function$;

revoke all on function public.post_receipt_to_job_cost(uuid) from public, anon;
grant execute on function public.post_receipt_to_job_cost(uuid) to authenticated, service_role;

comment on function public.post_receipt_to_job_cost(uuid) is
  'Idempotently posts one staff-visible receipt into its project job-cost actuals.';