-- Driver workplace and transport-task scheduling
insert into public.workplace_catalog(name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff)
select 'Driver','Vervoer van artiesten, crew en andere toegewezen personen van en naar het evenement.',45,true,0,0,null
where not exists (select 1 from public.workplace_catalog where lower(name)='driver');

update public.workplace_catalog
set sort_order=45,is_active=true,description='Vervoer van artiesten, crew en andere toegewezen personen van en naar het evenement.'
where lower(name)='driver';

create table if not exists public.driver_task_details (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  direction text not null check (direction in ('pickup','dropoff')),
  passenger_name text not null check (char_length(passenger_name) between 1 and 200),
  passenger_phone text not null check (char_length(passenger_phone) between 1 and 60),
  address text not null check (char_length(address) between 1 and 500),
  scheduled_at timestamptz not null,
  estimated_drive_minutes integer check (estimated_drive_minutes is null or estimated_drive_minutes >= 0),
  notify_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.driver_task_details enable row level security;

drop policy if exists driver_task_details_select on public.driver_task_details;
create policy driver_task_details_select on public.driver_task_details for select to authenticated
using (
  exists (
    select 1 from public.task_assignments a
    where a.task_id=driver_task_details.task_id and a.user_id=auth.uid()
  )
  or public.upt_is_admin(auth.uid())
);

create index if not exists driver_task_details_notify_idx
on public.driver_task_details(notify_at) where notified_at is null;
