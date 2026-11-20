-- Minimal Supabase auth dependencies for the disposable local PostgreSQL suite.
-- Financial tables, RLS, functions and triggers are loaded from real migrations.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create schema upt_administration_private;
create table auth.users(id uuid primary key);
insert into auth.users values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
create table public.events(id uuid primary key);
create table public.portal_role_assignments(
 user_id uuid,portal text,role text,approved boolean,revoked_at timestamptz
);
insert into public.portal_role_assignments values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','administration','administrative_staff',true,null);
create function auth.uid() returns uuid language sql stable set search_path='' as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create function public.upt_is_admin() returns boolean language sql stable set search_path='' as $$
 select coalesce(auth.uid()='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,false);
$$;
create function public.upt_is_approved() returns boolean language sql stable set search_path='' as $$
 select coalesce(auth.uid() in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
 ),false);
$$;
grant usage on schema public,auth to authenticated;
