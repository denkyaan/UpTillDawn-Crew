-- Recover staging installations missing the promotion feature migrations.
-- Existing installations and clean replays retain the original migration path.
do $recover$
begin
 if to_regclass('public.promotion_discipline') is null then
  execute $promotion_restore$
-- 20261023150000_promotion_discipline.sql
-- Promotion strikes and scoped suspensions. Only trusted admin RPCs may record violations.
create table if not exists public.promotion_discipline (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 strikes integer not null default 0 check (strikes between 0 and 2),
 suspension_count integer not null default 0 check (suspension_count between 0 and 2),
 blocked_until timestamptz,
 permanently_blocked boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.promotion_violations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 task_assignment_id uuid references public.task_assignments(id) on delete set null,
 reason text not null check (reason in ('missed_deadline','invalid_evidence')),
 details text not null,
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create unique index if not exists promotion_violations_assignment_reason_unique
 on public.promotion_violations(task_assignment_id,reason) where task_assignment_id is not null;
create index if not exists promotion_violations_user_idx on public.promotion_violations(user_id,created_at desc);
alter table public.promotion_discipline enable row level security;
alter table public.promotion_violations enable row level security;
revoke all on public.promotion_discipline, public.promotion_violations from anon,authenticated;
grant select on public.promotion_discipline,public.promotion_violations to authenticated;
create policy promotion_discipline_own_read on public.promotion_discipline for select to authenticated
 using(user_id=(select auth.uid()) or public.upt_is_admin());
create policy promotion_violations_own_read on public.promotion_violations for select to authenticated
 using(user_id=(select auth.uid()) or public.upt_is_admin());

create or replace function public.upt_promotion_is_blocked(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.promotion_discipline d where d.user_id=p_user
 and (d.permanently_blocked or d.blocked_until>now()))
$$;
revoke all on function public.upt_promotion_is_blocked(uuid) from public,anon;
grant execute on function public.upt_promotion_is_blocked(uuid) to authenticated;

create or replace function public.upt_admin_record_promotion_violation(
 p_user uuid,p_assignment uuid,p_reason text,p_details text
) returns integer language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_row public.promotion_discipline%rowtype;v_strikes integer;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and approved and not account_blocked)
 then raise exception 'Admin required' using errcode='42501';end if;
 if p_reason not in ('missed_deadline','invalid_evidence') or length(trim(coalesce(p_details,'')))<10
 then raise exception 'Specific violation evidence required' using errcode='22023';end if;
 if p_assignment is null or not exists(select 1 from public.task_assignments where id=p_assignment and user_id=p_user)
 then raise exception 'Assignment does not belong to user' using errcode='22023';end if;
 insert into public.promotion_discipline(user_id) values(p_user) on conflict do nothing;
 select * into v_row from public.promotion_discipline where user_id=p_user for update;
 if v_row.permanently_blocked or v_row.blocked_until>now()
 then raise exception 'Promotion account already blocked' using errcode='22023';end if;
 insert into public.promotion_violations(user_id,task_assignment_id,reason,details,recorded_by)
 values(p_user,p_assignment,p_reason,trim(p_details),v_actor);
 v_strikes:=v_row.strikes+1;
 if v_strikes>=3 then
  update public.promotion_discipline set strikes=0,suspension_count=least(suspension_count+1,2),
   blocked_until=case when suspension_count=0 then now()+interval '1 month' else null end,
   permanently_blocked=(suspension_count>=1),updated_at=now() where user_id=p_user;
 else
  update public.promotion_discipline set strikes=v_strikes,updated_at=now() where user_id=p_user;
 end if;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'promotion_violation','task_assignment',p_assignment,
 jsonb_build_object('user_id',p_user,'reason',p_reason,'strike',v_strikes));
 return v_strikes;
end;$$;
revoke all on function public.upt_admin_record_promotion_violation(uuid,uuid,text,text) from public,anon;
grant execute on function public.upt_admin_record_promotion_violation(uuid,uuid,text,text) to authenticated;

create or replace function public.upt_admin_unblock_promotion(p_user uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and approved and not account_blocked)
 then raise exception 'Admin required' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'Reason required' using errcode='22023';end if;
 update public.promotion_discipline set strikes=0,blocked_until=null,permanently_blocked=false,
 suspension_count=0,updated_at=now() where user_id=p_user;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'promotion_unblocked','profile',p_user,jsonb_build_object('reason',trim(p_reason)));
end;$$;
revoke all on function public.upt_admin_unblock_promotion(uuid,text) from public,anon;
grant execute on function public.upt_admin_unblock_promotion(uuid,text) to authenticated;


-- 20261023160000_promotion_admin_discipline_list.sql
-- Admin-only listing: never expose other users' disciplinary records to promoters.
create or replace function public.upt_admin_promotion_discipline_list()
returns table(user_id uuid,strikes integer,suspension_count integer,blocked_until timestamptz,permanently_blocked boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles
 where id=auth.uid() and role='admin' and approved and not account_blocked)
 then raise exception 'Admin required' using errcode='42501';end if;
 return query select d.user_id,d.strikes,d.suspension_count,d.blocked_until,d.permanently_blocked
 from public.promotion_discipline d order by d.updated_at desc limit 500;
end;$$;
revoke all on function public.upt_admin_promotion_discipline_list() from public,anon;
grant execute on function public.upt_admin_promotion_discipline_list() to authenticated;
notify pgrst,'reload schema';


-- 20261023170000_promotion_evidence_foundation.sql
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


-- 20261023180000_promotion_evidence_submission.sql
-- Validate promotion evidence registration within the database, not in browser input.
create or replace function public.upt_submit_promotion_evidence(p_assignment uuid,p_storage_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid;v_status text;
begin
 if v_actor is null then raise exception 'Login required' using errcode='42501';end if;
 if public.upt_promotion_is_blocked(v_actor) then raise exception 'Promotion blocked' using errcode='42501';end if;
 select status::text into v_status from public.task_assignments where id=p_assignment and user_id=v_actor for update;
 if not found then raise exception 'Assignment not found' using errcode='42501';end if;
 if upper(coalesce(v_status,'')) in ('COMPLETED','COMPLETE','DONE','CANCELLED','CANCELED') then raise exception 'Assignment closed' using errcode='42501';end if;
 if p_storage_path not like v_actor::text||'/promotion/%' or p_storage_path like '%..%'
 or p_sha256 !~ '^[0-9a-f]{64}$'
 then raise exception 'Invalid evidence metadata' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='work-media' and name=p_storage_path and owner_id=v_actor::text)
 then raise exception 'Evidence file missing' using errcode='22023';end if;
 insert into public.promotion_evidence(assignment_id,submitted_by,storage_path,evidence_sha256)
 values(p_assignment,v_actor,p_storage_path,p_sha256) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.upt_submit_promotion_evidence(uuid,text,text) from public,anon;
grant execute on function public.upt_submit_promotion_evidence(uuid,text,text) to authenticated;
notify pgrst,'reload schema';


-- 20261023190000_promotion_duplicate_evidence.sql
-- Duplicate image hashes are a review signal, not proof of fraud.
-- Flag matching files across submissions as inconclusive; never award strikes automatically.
create or replace function public.upt_promotion_evidence_duplicate_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(
  select 1 from public.promotion_evidence e
  where e.evidence_sha256=new.evidence_sha256 and e.id<>new.id
 ) then
  new.verification_status:='inconclusive';
  new.verification_details:=jsonb_build_object('reason','duplicate_file_hash','requires_independent_verification',true);
 end if;
 return new;
end;$$;
drop trigger if exists promotion_evidence_duplicate_guard on public.promotion_evidence;
create trigger promotion_evidence_duplicate_guard
 before insert on public.promotion_evidence
 for each row execute function public.upt_promotion_evidence_duplicate_guard();
revoke all on function public.upt_promotion_evidence_duplicate_guard() from public,anon,authenticated;
-- Do not allow users to complete promotion work by clicking a generic task-status button.
-- This restriction applies only to the promotion UI until dedicated promotion tasks are modeled.


-- 20261023200000_promotion_review_audit.sql
-- Trusted verification updates are restricted to an authenticated, approved administrator.
-- Inconclusive evidence never creates a strike. Automated verification is not yet configured.
create or replace function public.upt_admin_review_promotion_evidence(
 p_evidence uuid,p_status text,p_details text
) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_row public.promotion_evidence%rowtype;
begin
 if v_actor is null or not exists(
  select 1 from public.profiles where id=v_actor and role='admin' and approved and not account_blocked
 ) then raise exception 'Admin required' using errcode='42501';end if;
 if p_status not in ('verified','rejected','inconclusive') or length(trim(coalesce(p_details,'')))<10
 then raise exception 'Review status and evidence details required' using errcode='22023';end if;
 select * into v_row from public.promotion_evidence where id=p_evidence for update;
 if not found then raise exception 'Evidence not found' using errcode='22023';end if;
 if v_row.verification_status in ('verified','rejected')
 then raise exception 'Evidence already finalized' using errcode='22023';end if;
 update public.promotion_evidence set verification_status=p_status,
  verification_details=jsonb_build_object('review_reason',trim(p_details),'reviewed_by',v_actor),
  verified_at=now() where id=p_evidence;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'promotion_evidence_reviewed','promotion_evidence',p_evidence,
 jsonb_build_object('status',p_status,'reason',trim(p_details)));
end;$$;
revoke all on function public.upt_admin_review_promotion_evidence(uuid,text,text) from public,anon;
grant execute on function public.upt_admin_review_promotion_evidence(uuid,text,text) to authenticated;
notify pgrst,'reload schema';


-- 20261023210000_promotion_block_privacy.sql
-- Prevent authenticated promotion users from querying other users' sanction status.
-- Admin access is retained for administrative workflows.
create or replace function public.upt_promotion_is_blocked(p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'Login required' using errcode='42501';end if;
 if p_user is distinct from v_actor and not exists(
  select 1 from public.profiles p
  where p.id=v_actor and p.role='admin' and p.approved and not p.account_blocked
 ) then raise exception 'Not authorized' using errcode='42501';end if;
 return exists(
  select 1 from public.promotion_discipline d
  where d.user_id=p_user and (d.permanently_blocked or d.blocked_until>now())
 );
end;$$;
revoke all on function public.upt_promotion_is_blocked(uuid) from public,anon;
grant execute on function public.upt_promotion_is_blocked(uuid) to authenticated;
notify pgrst,'reload schema';


-- 20261023220000_promotion_reference_metadata.sql
-- Capture an immutable official reference hash for each evidence submission.
-- A matching hash proves file identity only; it does NOT prove a social post was published.
alter table public.promotion_evidence
 add column if not exists reference_sha256 text
 check(reference_sha256 is null or reference_sha256 ~ '^[0-9a-f]{64}$');
alter table public.promotion_evidence
 add column if not exists reference_source text;
create index if not exists promotion_evidence_pending_idx
 on public.promotion_evidence(submitted_at)
 where verification_status='pending';
-- Evidence can only be marked verified after independent verification;
-- equality to official media alone cannot establish publication.
comment on column public.promotion_evidence.reference_sha256 is
 'SHA-256 of the official reference media; hash equality alone does not verify a published post';
comment on column public.promotion_evidence.reference_source is
 'Identifier of the official reference material used for comparison';
notify pgrst,'reload schema';


-- 20261023230000_promotion_reference_registration.sql
-- Reference assets must be registered by approved admins before they can be compared.
create table if not exists public.promotion_reference_media(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 storage_path text not null unique,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists promotion_reference_media_task_idx on public.promotion_reference_media(task_id);
alter table public.promotion_reference_media enable row level security;
revoke all on public.promotion_reference_media from anon,authenticated;
grant select on public.promotion_reference_media to authenticated;
create policy promotion_reference_media_read on public.promotion_reference_media for select to authenticated
 using(public.upt_is_admin(auth.uid()) or exists(
  select 1 from public.task_assignments a where a.task_id=promotion_reference_media.task_id and a.user_id=auth.uid()
 ));
create or replace function public.upt_admin_register_promotion_reference(p_task uuid,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid;
begin
 if v_actor is null or not exists(select 1 from public.profiles p
  where p.id=v_actor and p.role='admin' and p.approved and not p.account_blocked)
 then raise exception 'Admin required' using errcode='42501';end if;
 if not exists(select 1 from public.tasks where id=p_task)
 then raise exception 'Task missing' using errcode='22023';end if;
 if p_path not like v_actor::text||'/%' or p_path like '%..%' or p_sha256 !~ '^[0-9a-f]{64}$'
 then raise exception 'Invalid reference' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='work-media' and name=p_path and owner_id=v_actor::text)
 then raise exception 'Reference file missing' using errcode='22023';end if;
 insert into public.promotion_reference_media(task_id,storage_path,sha256,created_by)
 values(p_task,p_path,p_sha256,v_actor) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.upt_admin_register_promotion_reference(uuid,text,text) from public,anon;
grant execute on function public.upt_admin_register_promotion_reference(uuid,text,text) to authenticated;
notify pgrst,'reload schema';


-- 20261023235000_promotion_reference_precheck.sql
-- Automated first-pass reference check. A hash match only means identical bytes,
-- never proof of a published social media post or grounds for a strike.
create or replace function public.upt_promotion_reference_precheck()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task uuid;v_reference record;v_count integer;
begin
 select a.task_id into v_task from public.task_assignments a
 where a.id=new.assignment_id;
 if v_task is null then return new;end if;
 select count(*) into v_count from public.promotion_reference_media r where r.task_id=v_task;
 if v_count=0 then
  new.verification_details=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reference_check','no_reference','publication_verified',false);
  return new;
 end if;
 select r.id,r.sha256 into v_reference from public.promotion_reference_media r
 where r.task_id=v_task and r.sha256=new.evidence_sha256 order by r.created_at desc limit 1;
 if found then
  new.reference_sha256=v_reference.sha256;
  new.reference_source=v_reference.id::text;
  new.verification_details=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reference_check','exact_file_match','publication_verified',false);
 else
  new.verification_details=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reference_check','no_exact_file_match','publication_verified',false);
 end if;
 return new;
end;$$;
drop trigger if exists promotion_reference_precheck_insert on public.promotion_evidence;
create trigger promotion_reference_precheck_insert before insert on public.promotion_evidence
 for each row execute function public.upt_promotion_reference_precheck();
comment on function public.upt_promotion_reference_precheck() is
 'Non-punitive automated file hash precheck; no post verification, approval or strikes';
notify pgrst,'reload schema';


-- 20261023235900_promotion_fk_indexes.sql
-- Foreign-key indexes required by SQL regression suite.
create index if not exists promotion_reference_media_created_by_idx
 on public.promotion_reference_media(created_by);
create index if not exists promotion_violations_recorded_by_idx
 on public.promotion_violations(recorded_by);


-- 20261023235930_promotion_duplicate_precheck_preservation.sql
-- Preserve reference precheck metadata when duplicate evidence is flagged.
-- Duplicate hashes remain inconclusive and must never automatically trigger sanctions.
create or replace function public.upt_promotion_evidence_duplicate_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(
  select 1 from public.promotion_evidence e
  where e.evidence_sha256=new.evidence_sha256 and e.id<>new.id
 ) then
  new.verification_status:='inconclusive';
  new.verification_details:=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reason','duplicate_file_hash','requires_independent_verification',true);
 end if;
 return new;
end;$$;
revoke all on function public.upt_promotion_evidence_duplicate_guard() from public,anon,authenticated;
comment on function public.upt_promotion_evidence_duplicate_guard() is
 'Preserves prior reference-check metadata; duplicates require independent verification, never automatic strikes';


-- 20261023235945_promotion_trigger_privileges.sql
-- Trigger functions are invoked by PostgreSQL triggers, never directly by app roles.
revoke all on function public.upt_promotion_reference_precheck() from public,anon,authenticated;


-- 20261025100000_promotion_reference_review_signals.sql
-- Review-only image-reference signals. Never infer publication or misconduct.
-- Preserve duplicate guard details and expose a consistent manual-review state.
create or replace function public.upt_promotion_reference_precheck()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_task uuid;
  v_reference record;
  v_count integer;
begin
  select a.task_id into v_task
  from public.task_assignments a where a.id = new.assignment_id;
  if v_task is null then return new; end if;

  select count(*) into v_count
  from public.promotion_reference_media r where r.task_id = v_task;

  if v_count = 0 then
    new.verification_details = coalesce(new.verification_details, '{}'::jsonb)
      || jsonb_build_object('reference_check','no_reference',
                            'publication_verified',false,
                            'requires_independent_verification',true);
    return new;
  end if;

  select r.id, r.sha256 into v_reference
  from public.promotion_reference_media r
  where r.task_id = v_task and r.sha256 = new.evidence_sha256
  order by r.created_at desc limit 1;

  if found then
    new.reference_sha256 = v_reference.sha256;
    new.reference_source = v_reference.id::text;
    new.verification_details = coalesce(new.verification_details, '{}'::jsonb)
      || jsonb_build_object('reference_check','exact_file_match',
                            'publication_verified',false,
                            'requires_independent_verification',true);
  else
    new.verification_details = coalesce(new.verification_details, '{}'::jsonb)
      || jsonb_build_object('reference_check','no_exact_file_match',
                            'publication_verified',false,
                            'requires_independent_verification',true);
  end if;
  return new;
end;$$;

comment on function public.upt_promotion_reference_precheck() is
 'Review-only hash signal; never verifies publication or applies sanctions';
notify pgrst, 'reload schema';


-- 20261025110000_promotion_evidence_submission_hardening.sql
-- Enforce evidence ownership, open assignments and image metadata in the database.
-- This is a new migration so already-deployed databases receive the correction.
create or replace function public.upt_submit_promotion_evidence(
 p_assignment uuid,p_storage_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_id uuid;
 v_status text;
 v_mime text;
 v_size bigint;
begin
 if v_actor is null then raise exception 'Login required' using errcode='42501'; end if;
 if public.upt_promotion_is_blocked(v_actor) then
  raise exception 'Promotion blocked' using errcode='42501';
 end if;
 select status::text into v_status from public.task_assignments
 where id=p_assignment and user_id=v_actor for update;
 if not found then raise exception 'Assignment not found' using errcode='42501'; end if;
 if upper(coalesce(v_status,'')) in ('COMPLETED','COMPLETE','DONE','CANCELLED','CANCELED') then
  raise exception 'Assignment closed' using errcode='42501';
 end if;
 if p_storage_path not like v_actor::text||'/promotion/%'
  or p_storage_path like '%..%'
  or p_sha256 !~ '^[0-9a-f]{64}$' then
  raise exception 'Invalid evidence metadata' using errcode='22023';
 end if;
 select o.metadata->>'mimetype',nullif(o.metadata->>'size','')::bigint
 into v_mime,v_size
 from storage.objects o
 where o.bucket_id='work-media' and o.name=p_storage_path
 and o.owner_id=v_actor::text;
 if not found then raise exception 'Evidence file missing' using errcode='22023'; end if;
 if coalesce(v_mime,'') not in ('image/jpeg','image/png','image/webp')
  or coalesce(v_size,0) not between 1 and 10485760 then
  raise exception 'Invalid evidence image metadata' using errcode='22023';
 end if;
 insert into public.promotion_evidence(assignment_id,submitted_by,storage_path,evidence_sha256)
 values(p_assignment,v_actor,p_storage_path,p_sha256) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.upt_submit_promotion_evidence(uuid,text,text) from public,anon;
grant execute on function public.upt_submit_promotion_evidence(uuid,text,text) to authenticated;
notify pgrst,'reload schema';


-- 20261025120000_promotion_reference_upload_hardening.sql
-- Verify official reference images at the database trust boundary.
-- Browser-supplied MIME types and client-side checks are not authoritative.
create or replace function public.upt_admin_register_promotion_reference(
 p_task uuid,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_id uuid;
 v_mime text;
 v_size bigint;
begin
 if v_actor is null or not exists(
  select 1 from public.profiles p where p.id=v_actor
   and p.role='admin' and p.approved and not p.account_blocked
 ) then raise exception 'Admin required' using errcode='42501'; end if;
 if not exists(select 1 from public.tasks where id=p_task) then
  raise exception 'Task missing' using errcode='22023';
 end if;
 if p_path not like v_actor::text||'/promotion-reference/%'
  or p_path like '%..%' or p_sha256 !~ '^[0-9a-f]{64}$' then
  raise exception 'Invalid reference' using errcode='22023';
 end if;
 select o.metadata->>'mimetype',nullif(o.metadata->>'size','')::bigint
 into v_mime,v_size
 from storage.objects o
 where o.bucket_id='work-media' and o.name=p_path and o.owner_id=v_actor::text;
 if not found then raise exception 'Reference file missing' using errcode='22023'; end if;
 if coalesce(v_mime,'') not in ('image/jpeg','image/png','image/webp')
  or coalesce(v_size,0) not between 1 and 10485760 then
  raise exception 'Invalid reference image metadata' using errcode='22023';
 end if;
 insert into public.promotion_reference_media(task_id,storage_path,sha256,created_by)
 values(p_task,p_path,p_sha256,v_actor) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.upt_admin_register_promotion_reference(uuid,text,text) from public,anon;
grant execute on function public.upt_admin_register_promotion_reference(uuid,text,text) to authenticated;
notify pgrst,'reload schema';


-- 20261025130000_promotion_review_signal_preservation.sql
-- Preserve machine-generated evidence review signals when an administrator records
-- a decision. The previous function replaced verification_details wholesale.
-- Automated scores remain non-authoritative and never create sanctions.
create or replace function public.upt_admin_review_promotion_evidence(
 p_evidence uuid,p_status text,p_details text
) returns void language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();
 v_row public.promotion_evidence%rowtype;
 v_reason text:=trim(coalesce(p_details,''));
begin
 if v_actor is null or not exists(
  select 1 from public.profiles
  where id=v_actor and role='admin' and approved and not account_blocked
 ) then raise exception 'Admin required' using errcode='42501';end if;
 if p_status not in ('verified','rejected','inconclusive') or length(v_reason)<10
 then raise exception 'Review status and evidence details required' using errcode='22023';end if;
 select * into v_row from public.promotion_evidence where id=p_evidence for update;
 if not found then raise exception 'Evidence not found' using errcode='22023';end if;
 if v_row.verification_status in ('verified','rejected')
 then raise exception 'Evidence already finalized' using errcode='22023';end if;
 update public.promotion_evidence
 set verification_status=p_status,
 verification_details=coalesce(v_row.verification_details,'{}'::jsonb)
  || jsonb_build_object('review_reason',v_reason,'reviewed_by',v_actor,'reviewed_at',now()),
 verified_at=now()
 where id=p_evidence;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'promotion_evidence_reviewed','promotion_evidence',p_evidence,
 jsonb_build_object('status',p_status,'reason',v_reason,
 'previous_status',v_row.verification_status));
end;$$;
revoke all on function public.upt_admin_review_promotion_evidence(uuid,text,text) from public,anon;
grant execute on function public.upt_admin_review_promotion_evidence(uuid,text,text) to authenticated;
notify pgrst,'reload schema';


-- 20261028191000_promotion_directory.sql
-- Promotion directory: no direct exposure of portal_role_assignments to other users.
create or replace function public.upt_promotion_directory()
returns table(id uuid, full_name text, profile_photo_url text, portal_label text)
language sql stable security definer
set search_path = ''
as $$
 with actor as (
   select p.id, p.role, (p.role='admin') as is_admin
   from public.profiles p where p.id=(select auth.uid())
     and p.approved and not coalesce(p.account_blocked,false)
 ), permitted as (
   select exists (
     select 1 from public.portal_role_assignments a
     join actor on actor.id=a.user_id
     where a.portal='promotion' and a.approved and a.revoked_at is null
   ) or exists(select 1 from actor where is_admin) as ok
 ), eligible as (
   select p.id,p.full_name,p.profile_photo_url,
     case when a.portal='promotion' then 'promotion' else 'events' end as portal_label
   from public.profiles p
   join public.portal_role_assignments a on a.user_id=p.id
   where p.approved and not coalesce(p.account_blocked,false)
     and a.approved and a.revoked_at is null
     and a.portal in ('promotion','events')
     and (a.portal='promotion' or exists(
       select 1 from actor u where u.role in ('staff','responsible_lead','admin')
     ))
 )
 select e.id,e.full_name,e.profile_photo_url,e.portal_label
 from eligible e cross join permitted k where k.ok
 order by case when e.portal_label='promotion' then 0 else 1 end,e.full_name,e.id;
$$;
revoke all on function public.upt_promotion_directory() from public,anon;
grant execute on function public.upt_promotion_directory() to authenticated;
notify pgrst,'reload schema';


-- 20261028192000_chat_read_receipts.sql
-- Read receipts for chat messages. Only channel members can query.
create or replace function public.upt_chat_message_readers(p_message uuid)
returns table(user_id uuid, full_name text, profile_photo_url text, read_at timestamptz)
language plpgsql stable security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare v_channel uuid; v_created timestamptz;
begin
 select m.channel_id,m.created_at into v_channel,v_created
 from public.messages m where m.id=p_message and m.moderated_at is null;
 if v_channel is null or not public.upt_is_approved() or not public.upt_can_read_channel(v_channel) then
   raise exception 'Geen toegang tot leesbevestigingen.';
 end if;
 return query
 select p.id,p.full_name,p.profile_photo_url,s.last_read_at
 from upt_private.chat_user_states s
 join public.chat_members cm on cm.channel_id=s.channel_id and cm.user_id=s.user_id
 join public.profiles p on p.id=s.user_id and p.approved=true
 where s.channel_id=v_channel and s.user_id<>auth.uid()
   and s.last_read_at>=v_created
 order by s.last_read_at desc,p.full_name
 limit 200;
end;
$$;
revoke all on function public.upt_chat_message_readers(uuid) from public,anon;
grant execute on function public.upt_chat_message_readers(uuid) to authenticated;


-- 20261028193000_promotion_directory_role_scoping.sql
-- Directory access follows approved portal assignments, not the legacy profile role.
create or replace function public.upt_promotion_directory()
returns table(id uuid, full_name text, profile_photo_url text, portal_label text)
language sql stable security definer
set search_path = ''
as $$
 with actor as (
   select p.id,(p.role='admin') as is_admin
   from public.profiles p
   where p.id=(select auth.uid()) and p.approved
     and not coalesce(p.account_blocked,false)
 ), access as (
   select
     exists(select 1 from actor where is_admin)
       or exists(select 1 from public.portal_role_assignments a
         join actor on actor.id=a.user_id
         where a.portal='promotion' and a.approved and a.revoked_at is null) as promotion_ok,
     exists(select 1 from actor where is_admin)
       or exists(select 1 from public.portal_role_assignments a
         join actor on actor.id=a.user_id
         where a.portal='events' and a.approved and a.revoked_at is null) as events_ok
 ), members as (
   select distinct p.id,p.full_name,p.profile_photo_url,a.portal
   from public.profiles p
   join public.portal_role_assignments a on a.user_id=p.id
   where p.approved and not coalesce(p.account_blocked,false)
     and a.approved and a.revoked_at is null
     and a.portal in ('promotion','events')
 )
 select m.id,m.full_name,m.profile_photo_url,m.portal::text
 from members m cross join access x
 where x.promotion_ok and (m.portal='promotion' or x.events_ok)
 order by case when m.portal='promotion' then 0 else 1 end,m.full_name,m.id;
$$;
revoke all on function public.upt_promotion_directory() from public,anon;
grant execute on function public.upt_promotion_directory() to authenticated;
notify pgrst,'reload schema';


-- 20261028194000_promotion_presence.sql
-- Presence is derived only from authenticated heartbeats, never inferred from account approval.
create table if not exists upt_private.crew_presence (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 last_seen_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table upt_private.crew_presence enable row level security;
revoke all on upt_private.crew_presence from public,anon,authenticated;

create or replace function public.upt_promotion_presence_ping()
returns void language plpgsql security definer
set search_path='pg_catalog','public','upt_private'
as $$
begin
 if auth.uid() is null or not public.upt_is_approved() then
   raise exception 'Geen toegang.';
 end if;
 insert into upt_private.crew_presence(user_id,last_seen_at,updated_at)
 values(auth.uid(),now(),now())
 on conflict(user_id) do update set last_seen_at=now(),updated_at=now();
end;
$$;

create or replace function public.upt_promotion_presence()
returns table(user_id uuid,last_seen_at timestamptz)
language sql stable security definer
set search_path=''
as $$
 select p.user_id,p.last_seen_at from upt_private.crew_presence p
 where exists(
  select 1 from public.upt_promotion_directory() d where d.id=p.user_id
 );
$$;
revoke all on function public.upt_promotion_presence_ping() from public,anon;
revoke all on function public.upt_promotion_presence() from public,anon;
grant execute on function public.upt_promotion_presence_ping() to authenticated;
grant execute on function public.upt_promotion_presence() to authenticated;
notify pgrst,'reload schema';


-- 20261028195000_promotion_chat_rooms.sql
-- Dedicated promotion conversations, independent of crew-wide organization chat.
create table if not exists public.promotion_chat_messages (
 id uuid primary key default gen_random_uuid(),
 room text not null check(room in ('general','announcements')),
 sender_id uuid not null references public.profiles(id),
 body text not null check(length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists promotion_chat_messages_room_created_idx
 on public.promotion_chat_messages(room,created_at desc);
alter table public.promotion_chat_messages enable row level security;

create or replace function public.upt_promotion_chat_allowed()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approved and not coalesce(p.account_blocked,false)
 and (p.role='admin' or exists(
 select 1 from public.portal_role_assignments a
 where a.user_id=p.id and a.portal='promotion'
 and a.approved and a.revoked_at is null)));
$$;
revoke all on function public.upt_promotion_chat_allowed() from public,anon;
grant execute on function public.upt_promotion_chat_allowed() to authenticated;

drop policy if exists promotion_chat_read on public.promotion_chat_messages;
create policy promotion_chat_read on public.promotion_chat_messages
 for select to authenticated using (public.upt_promotion_chat_allowed());
drop policy if exists promotion_chat_send on public.promotion_chat_messages;
create policy promotion_chat_send on public.promotion_chat_messages
 for insert to authenticated with check (
 sender_id=(select auth.uid()) and public.upt_promotion_chat_allowed()
 and (room='general' or public.upt_is_admin())
);
revoke all on public.promotion_chat_messages from anon;
grant select,insert on public.promotion_chat_messages to authenticated;
notify pgrst,'reload schema';


-- 20261028210000_portal_role_admin_read.sql
-- Allow approved, unblocked administrators to inspect portal entitlements.
-- Other users retain access only to their own assignments.
drop policy if exists portal_role_admin_read on public.portal_role_assignments;
create policy portal_role_admin_read on public.portal_role_assignments
 for select to authenticated
 using (exists (
   select 1 from public.profiles actor
   where actor.id=(select auth.uid())
     and actor.role='admin'
     and actor.approved=true
     and actor.account_blocked=false
 ));


-- 20261028213000_atomic_portal_role_approval.sql
-- V2.1 privileged portal role provisioning. Caller identity comes exclusively from auth.uid().
-- All writes and their audit event are atomic; clients retain no table mutation privileges.
create or replace function public.upt_admin_set_portal_role(
  p_user_id uuid, p_portal text, p_role text, p_action text
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_approved boolean;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles
    where id = v_actor and role = 'admin' and approved = true and account_blocked = false
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Cannot change your own roles or an empty user' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id=p_user_id and approved=true and account_blocked=false) then
    raise exception 'Target user is not approved and active' using errcode = '22023';
  end if;
  if not (
    (p_portal='events' and p_role in ('event_staff','event_responsible','admin'))
    or (p_portal='promotion' and p_role in ('promoter','admin'))
    or (p_portal='administration' and p_role in ('administrative_staff','admin'))
  ) or p_action not in ('assign','assign_approved','approve','revoke') then
    raise exception 'Invalid portal, role or action' using errcode = '22023';
  end if;
  if p_role = 'admin' then
    raise exception 'Admin grants require a separate privileged process' using errcode = '42501';
  end if;
  if p_action='assign_approved' then
    insert into public.portal_role_assignments(user_id,portal,role,approved,approved_by,approved_at,revoked_at)
    values(p_user_id,p_portal,p_role,true,v_actor,now(),null)
    on conflict(user_id,portal,role) do update
      set approved=true,approved_by=v_actor,approved_at=now(),revoked_at=null
    where public.portal_role_assignments.revoked_at is not null
       or public.portal_role_assignments.approved=false
    returning id into v_id;
    if v_id is null then
      raise exception 'Role already active' using errcode='22023';
    end if;
  elsif p_action='assign' then
    insert into public.portal_role_assignments(user_id,portal,role,approved)
    values(p_user_id,p_portal,p_role,false)
    on conflict(user_id,portal,role) do update
      set approved=false, approved_by=null, approved_at=null, revoked_at=null
    returning id into v_id;
  elsif p_action='approve' then
    update public.portal_role_assignments
      set approved=true,approved_by=v_actor,approved_at=now(),revoked_at=null
    where user_id=p_user_id and portal=p_portal and role=p_role
      and approved=false and revoked_at is null
    returning id into v_id;
  else
    update public.portal_role_assignments
      set approved=false,approved_by=null,approved_at=null,revoked_at=now()
    where user_id=p_user_id and portal=p_portal and role=p_role
      and revoked_at is null
    returning id into v_id;
  end if;
  if v_id is null then
    raise exception 'No matching assignment in the required state' using errcode='22023';
  end if;
  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'portal_role_'||p_action,'portal_role_assignment',v_id,
      jsonb_build_object('user_id',p_user_id,'portal',p_portal,'role',p_role));
  return v_id;
end;
$$;
revoke all on function public.upt_admin_set_portal_role(uuid,text,text,text) from public,anon;
grant execute on function public.upt_admin_set_portal_role(uuid,text,text,text) to authenticated;

$promotion_restore$;
 end if;
end $recover$;
notify pgrst,'reload schema';
