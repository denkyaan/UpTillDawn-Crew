-- Tighten staff visibility for tasks/instructions and make operational work available only during active events.

alter table public.personal_instructions
  add column if not exists workplace_id uuid references public.workplaces(id) on delete set null;

create index if not exists idx_personal_instructions_workplace_id
  on public.personal_instructions(workplace_id)
  where workplace_id is not null;

create or replace function upt_private.event_active(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event
      and now() >= e.start_at
      and now() <= e.end_at
  );
$$;

revoke all on function upt_private.event_active(uuid) from public, anon;
grant execute on function upt_private.event_active(uuid) to authenticated;

create or replace function public.upt_can_manage_task(p_task uuid, p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task
      and (
        public.upt_is_admin(p_uid)
        or (
          t.workplace_id is not null
          and public.upt_is_responsible(t.event_id, t.workplace_id, p_uid)
        )
      )
  );
$$;

revoke all on function public.upt_can_manage_task(uuid, uuid) from public, anon;
grant execute on function public.upt_can_manage_task(uuid, uuid) to authenticated;

create or replace function public.upt_can_read_task(p_task uuid, p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_uid
      and p.approved = true
  )
  and exists (
    select 1
    from public.tasks t
    where t.id = p_task
      and (
        public.upt_is_admin(p_uid)
        or (
          t.workplace_id is not null
          and public.upt_is_responsible(t.event_id, t.workplace_id, p_uid)
        )
        or exists (
          select 1
          from public.task_assignments ta
          where ta.task_id = t.id
            and ta.user_id = p_uid
        )
      )
  );
$$;

revoke all on function public.upt_can_read_task(uuid, uuid) from public, anon;
grant execute on function public.upt_can_read_task(uuid, uuid) to authenticated;

drop policy if exists tasks_read on public.tasks;
create policy tasks_read
on public.tasks
for select
to authenticated
using (public.upt_can_read_task(id, (select auth.uid())));

drop policy if exists task_assignments_read on public.task_assignments;
create policy task_assignments_read
on public.task_assignments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.upt_can_manage_task(task_id, (select auth.uid()))
);

drop policy if exists personal_instructions_read on public.personal_instructions;
create policy personal_instructions_read
on public.personal_instructions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.upt_is_admin((select auth.uid()))
  or (
    workplace_id is not null
    and public.upt_is_responsible(event_id, workplace_id, (select auth.uid()))
  )
);

drop policy if exists personal_instructions_admin_insert on public.personal_instructions;
drop policy if exists personal_instructions_admin_update on public.personal_instructions;
drop policy if exists personal_instructions_admin_delete on public.personal_instructions;
drop policy if exists personal_instructions_manage_insert on public.personal_instructions;
drop policy if exists personal_instructions_manage_update on public.personal_instructions;
drop policy if exists personal_instructions_manage_delete on public.personal_instructions;

create policy personal_instructions_manage_insert
on public.personal_instructions
for insert
to authenticated
with check (
  public.upt_is_admin((select auth.uid()))
  or (
    workplace_id is not null
    and public.upt_is_responsible(event_id, workplace_id, (select auth.uid()))
    and exists (
      select 1
      from public.shifts s
      where s.event_id = personal_instructions.event_id
        and s.workplace_id = personal_instructions.workplace_id
        and s.user_id = personal_instructions.user_id
        and s.status <> 'cancelled'
    )
  )
);

create policy personal_instructions_manage_update
on public.personal_instructions
for update
to authenticated
using (
  public.upt_is_admin((select auth.uid()))
  or (
    workplace_id is not null
    and public.upt_is_responsible(event_id, workplace_id, (select auth.uid()))
  )
)
with check (
  public.upt_is_admin((select auth.uid()))
  or (
    workplace_id is not null
    and public.upt_is_responsible(event_id, workplace_id, (select auth.uid()))
    and exists (
      select 1
      from public.shifts s
      where s.event_id = personal_instructions.event_id
        and s.workplace_id = personal_instructions.workplace_id
        and s.user_id = personal_instructions.user_id
        and s.status <> 'cancelled'
    )
  )
);

create policy personal_instructions_manage_delete
on public.personal_instructions
for delete
to authenticated
using (
  public.upt_is_admin((select auth.uid()))
  or (
    workplace_id is not null
    and public.upt_is_responsible(event_id, workplace_id, (select auth.uid()))
  )
);

create or replace function public.upt_responsible_event_members(p_event uuid, p_workplace uuid)
returns table(id uuid, full_name text, phone_number text, profile_photo_url text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  if not exists (
    select 1
    from public.workplaces w
    where w.id = p_workplace
      and w.event_id = p_event
  ) then
    raise exception 'Werkplek niet gevonden.';
  end if;

  if not (
    public.upt_is_admin(auth.uid())
    or public.upt_is_responsible(p_event, p_workplace, auth.uid())
  ) then
    raise exception 'Geen toegang.';
  end if;

  return query
  select distinct p.id, p.full_name, p.phone_number, p.profile_photo_url
  from public.profiles p
  join public.shifts s on s.user_id = p.id
  where s.event_id = p_event
    and s.workplace_id = p_workplace
    and s.status <> 'cancelled'
    and p.approved = true
  order by p.full_name nulls last, p.id;
end;
$$;

revoke all on function public.upt_responsible_event_members(uuid, uuid) from public, anon;
grant execute on function public.upt_responsible_event_members(uuid, uuid) to authenticated;

DO $$
BEGIN
  IF to_regclass('public.work_attachments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS work_attachments_read ON public.work_attachments';
    EXECUTE $policy$
      CREATE POLICY work_attachments_read
      ON public.work_attachments
      FOR SELECT
      TO authenticated
      USING (
        uploaded_by = (select auth.uid())
        OR public.upt_is_admin()
        OR (
          briefing_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.briefings b
            WHERE b.id = work_attachments.briefing_id
              AND public.upt_can_access_workplace(b.event_id, b.workplace_id)
          )
        )
        OR (
          personal_instruction_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.personal_instructions pi
            WHERE pi.id = work_attachments.personal_instruction_id
              AND (
                pi.user_id = (select auth.uid())
                OR (
                  pi.workplace_id IS NOT NULL
                  AND public.upt_is_responsible(pi.event_id, pi.workplace_id, (select auth.uid()))
                )
              )
              AND upt_private.event_operational(pi.event_id)
          )
        )
        OR (
          task_id IS NOT NULL
          AND public.upt_can_read_task(task_id, (select auth.uid()))
          AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = work_attachments.task_id
              AND upt_private.event_operational(t.event_id)
          )
        )
      )
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS work_attachments_insert ON public.work_attachments';
    EXECUTE $policy$
      CREATE POLICY work_attachments_insert
      ON public.work_attachments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        uploaded_by = (select auth.uid())
        AND split_part(storage_path, '/', 1) = (select auth.uid())::text
        AND (
          public.upt_is_admin()
          OR (
            briefing_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.briefings b
              WHERE b.id = work_attachments.briefing_id
                AND b.workplace_id IS NOT NULL
                AND public.upt_is_responsible(b.event_id, b.workplace_id)
            )
          )
          OR (
            personal_instruction_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.personal_instructions pi
              WHERE pi.id = work_attachments.personal_instruction_id
                AND pi.workplace_id IS NOT NULL
                AND public.upt_is_responsible(pi.event_id, pi.workplace_id)
            )
          )
          OR (
            task_id IS NOT NULL
            AND public.upt_can_manage_task(task_id, (select auth.uid()))
          )
        )
      )
    $policy$;
  END IF;
END
$$;

create or replace function upt_private.require_active_event_for_operation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event uuid;
begin
  if tg_table_name = 'work_sessions' then
    v_event := new.event_id;
  elsif tg_table_name = 'check_ins' then
    v_event := new.event_id;
  else
    return new;
  end if;

  if v_event is not null and not upt_private.event_active(v_event) then
    raise exception 'Deze actie is pas beschikbaar vanaf de start van het evenement.';
  end if;

  return new;
end;
$$;

revoke all on function upt_private.require_active_event_for_operation() from public, anon, authenticated;

drop trigger if exists upt_require_active_event_for_checkin on public.check_ins;
create trigger upt_require_active_event_for_checkin
before insert on public.check_ins
for each row
execute function upt_private.require_active_event_for_operation();

drop trigger if exists upt_require_active_event_for_work on public.work_sessions;
create trigger upt_require_active_event_for_work
before insert on public.work_sessions
for each row
execute function upt_private.require_active_event_for_operation();
