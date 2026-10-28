-- Administrative roster proposals: no changes to operational shifts until an admin approves.
create table if not exists public.admin_roster_proposals (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 180),
 details text not null default '',
 proposed_start timestamptz not null,
 proposed_end timestamptz not null,
 status text not null default 'draft' check(status in ('draft','submitted','approved','rejected')),
 created_by uuid not null default auth.uid() references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint admin_roster_time_check check (proposed_end > proposed_start),
 constraint admin_roster_review_check check ((status in ('draft','submitted') and reviewed_by is null and reviewed_at is null) or (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null))
);
create index if not exists admin_roster_proposals_event_idx on public.admin_roster_proposals(event_id);
create index if not exists admin_roster_proposals_created_by_idx on public.admin_roster_proposals(created_by);
create index if not exists admin_roster_proposals_reviewed_by_idx on public.admin_roster_proposals(reviewed_by);
alter table public.admin_roster_proposals enable row level security;
revoke all on public.admin_roster_proposals from anon, authenticated;
grant select on public.admin_roster_proposals to authenticated;
create policy admin_roster_read on public.admin_roster_proposals for select to authenticated using (public.upt_can_manage_administration());
create or replace function public.upt_admin_roster_create(p_event uuid,p_title text,p_details text,p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not public.upt_can_manage_administration() then raise exception 'Not authorized'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 180 or p_start is null or p_end is null or p_end<=p_start then raise exception 'Invalid roster proposal'; end if;
 insert into public.admin_roster_proposals(event_id,title,details,proposed_start,proposed_end)
 values(p_event,trim(p_title),left(coalesce(p_details,''),2000),p_start,p_end) returning id into v_id;
 return v_id;
end $$;
create or replace function public.upt_admin_roster_submit(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.upt_can_manage_administration() then raise exception 'Not authorized'; end if;
 update public.admin_roster_proposals set status='submitted',updated_at=now()
 where id=p_id and status='draft' and (created_by=auth.uid() or public.upt_is_admin());
 if not found then raise exception 'Proposal cannot be submitted'; end if;
end $$;
create or replace function public.upt_admin_roster_review(p_id uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.upt_is_admin() or not public.upt_is_approved() then raise exception 'Admin required'; end if;
 if p_approve is null or (not p_approve and length(trim(coalesce(p_note,'')))=0) then raise exception 'Review note required'; end if;
 update public.admin_roster_proposals
 set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(p_note,2000),updated_at=now()
 where id=p_id and status='submitted' and created_by<>auth.uid();
 if not found then raise exception 'Proposal cannot be reviewed'; end if;
end $$;
revoke all on function public.upt_admin_roster_create(uuid,text,text,timestamptz,timestamptz),public.upt_admin_roster_submit(uuid),public.upt_admin_roster_review(uuid,boolean,text) from public,anon;
grant execute on function public.upt_admin_roster_create(uuid,text,text,timestamptz,timestamptz),public.upt_admin_roster_submit(uuid),public.upt_admin_roster_review(uuid,boolean,text) to authenticated;
