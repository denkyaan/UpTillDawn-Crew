-- Private financial attachment registry. No public URLs or automatic accounting posting.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('admin-financial-attachments','admin-financial-attachments',false,20971520,
 array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=20971520,
 allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.admin_financial_attachments (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.admin_financial_documents(id) on delete restrict,
 storage_path text not null unique,
 original_name text not null check (length(original_name) between 1 and 180),
 mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes bigint not null check (size_bytes between 1 and 20971520),
 uploaded_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 constraint admin_financial_attachment_path check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp)$')
);
create index if not exists admin_financial_attachments_document_idx on public.admin_financial_attachments(document_id);
create index if not exists admin_financial_attachments_uploader_idx on public.admin_financial_attachments(uploaded_by);
alter table public.admin_financial_attachments enable row level security;
revoke all on public.admin_financial_attachments from anon;
grant select,insert on public.admin_financial_attachments to authenticated;
create policy admin_financial_attachment_read on public.admin_financial_attachments
 for select to authenticated using (public.upt_can_manage_administration());
create policy admin_financial_attachment_insert on public.admin_financial_attachments
 for insert to authenticated with check (
 public.upt_can_manage_administration() and uploaded_by = auth.uid()
 and split_part(storage_path,'/',1) = auth.uid()::text
 and exists(select 1 from public.admin_financial_documents d where d.id=document_id and d.status in ('draft','review'))
);
create policy admin_financial_storage_read on storage.objects for select to authenticated
 using (bucket_id='admin-financial-attachments' and public.upt_can_manage_administration());
create policy admin_financial_storage_insert on storage.objects for insert to authenticated
 with check (bucket_id='admin-financial-attachments' and public.upt_can_manage_administration()
 and (storage.foldername(name))[1] = auth.uid()::text);
-- No update/delete policies: records and files are retained for audit.
