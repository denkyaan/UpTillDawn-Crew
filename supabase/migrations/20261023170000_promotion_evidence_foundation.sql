-- Store promotion evidence metadata without accepting unverified screenshots as completion.
create table if not exists public.promotion_evidence (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.task_assignments(id) on delete cascade,
 submitted_by uuid not null references public.profiles(id) on delete cascade,
 storage_path text not null unique,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 verification_status text not null default 'pending'
  check(verification_status in ('pending','verified','rejected','inconclusive')),
 verification_details jsonb not null default '{}'::jsonb,
 submitted_at timestamptz not null default now(),
 verified_at timestamptz,
 unique(assignment_id,evidence_sha256)
);
create index if not exists promotion_evidence_user_idx
 on public.promotion_evidence(submitted_by,submitted_at desc);
alter table public.promotion_evidence enable row level security;
revoke all on public.promotion_evidence from anon,authenticated;
grant select on public.promotion_evidence to authenticated;
create policy promotion_evidence_own_read on public.promotion_evidence for select to authenticated
 using(submitted_by=(select auth.uid()) or public.upt_is_admin(auth.uid()));
-- A verified state can only be written by trusted backend workflows.
-- Neither direct client INSERT nor UPDATE nor DELETE is granted.
notify pgrst,'reload schema';
