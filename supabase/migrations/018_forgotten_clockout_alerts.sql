-- Table to log forgotten clock-out alerts sent by the nightly cron job.
-- Used for analytics: chart + table in /admin/forgotten-clockouts

create table if not exists forgotten_clockout_alerts (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references user_profiles(id) on delete cascade,
    work_date   date not null,
    notified_at timestamptz not null default now(),
    constraint forgotten_clockout_alerts_user_date_unique unique (user_id, work_date)
);

create index if not exists idx_forgotten_clockout_alerts_date on forgotten_clockout_alerts (work_date desc);
create index if not exists idx_forgotten_clockout_alerts_user on forgotten_clockout_alerts (user_id);

-- RLS: only admin/service role can read/write
alter table forgotten_clockout_alerts enable row level security;

create policy "Admin can view forgotten clockout alerts"
    on forgotten_clockout_alerts for select
    using (
        exists (
            select 1 from user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'::user_role
        )
    );
