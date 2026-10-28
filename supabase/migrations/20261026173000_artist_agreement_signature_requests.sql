-- External signing requests: auditable preparation, no automatic signing or dispatch.
create table public.admin_artist_agreement_signature_requests (
 id uuid primary key default gen_random_uuid(),
 agreement_version_id uuid not null references public.admin_artist_agreement_versions(id),
 recipient_email text not null check (length(recipient_email) between 5 and 320),
 status text not null default 'prepared' check (status in ('prepared','cancelled')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 constraint artist_signature_cancel_consistency check ((status='cancelled') = (cancelled_at is not null))
);
create index admin_artist_signature_requests_version_idx on public.admin_artist_agreement_signature_requests(agreement_version_id,created_at desc);
create index admin_artist_signature_requests_created_by_idx on public.admin_artist_agreement_signature_requests(created_by);
alter table public.admin_artist_agreement_signature_requests enable row level security;
create policy artist_signature_requests_select on public.admin_artist_agreement_signature_requests for select to authenticated using (public.upt_can_manage_administration());
create policy artist_signature_requests_insert on public.admin_artist_agreement_signature_requests for insert to authenticated with check (
 public.upt_can_manage_administration() and created_by=(select auth.uid())
 and exists (select 1 from public.admin_artist_agreement_versions v where v.id=agreement_version_id and v.approved_at is not null)
);
grant select,insert on public.admin_artist_agreement_signature_requests to authenticated;
