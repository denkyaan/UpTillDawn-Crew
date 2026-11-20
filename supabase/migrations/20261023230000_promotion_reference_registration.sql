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
