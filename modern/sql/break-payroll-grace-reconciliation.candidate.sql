-- UP TILL DAWN CANDIDATE / NON-DEPLOYABLE / REQUIRES QA AND RELEASE APPROVAL
-- This is a REVIEW CANDIDATE, not a Supabase CLI migration and NEVER auto-run.
-- Materialize through 'supabase migration new' once QA-controlled tests pass.
-- No Production or Main-QA DDL has been changed by this PR.
-- One user/event receives 3600 seconds payable break with a 600-second
-- grace TRIGGER. When 4200 seconds is exceeded, all excess above 3600
-- becomes deductible; reallocate across all event sessions chronologically.
begin;
-- Private, immutable, invoker arithmetic: never grant anonymous/user EXECUTE.
-- 60 minutes paid break per user/event; 10-minute grace is a trigger, not
-- a further paid allowance. At 70:00 no deduction; at 70:01, 10:01 deducted.
create or replace function upt_private.break_deduction_seconds(
 p_prior numeric,p_used numeric,p_event_total numeric
) returns numeric language plpgsql immutable strict security invoker
set search_path = ''
as $function$
begin
 if p_prior<0 or p_used<0 or p_event_total<p_prior+p_used then
  raise exception 'Invalid event break accounting' using errcode='22023';
 end if;
 if p_event_total<=4200 then return 0; end if;
 return greatest(p_used-greatest(3600-p_prior,0),0);
end
$function$;
revoke all on function upt_private.break_deduction_seconds(numeric,numeric,numeric)
 from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.upt_work_session_time_summary(p_work_session uuid)
 RETURNS TABLE(work_session_id uuid, gross_seconds bigint, break_seconds bigint, break_allowance_seconds bigint, regular_break_seconds bigint, excess_break_seconds bigint, break_balance_seconds bigint, net_payable_seconds bigint, active_break boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ws public.work_sessions%ROWTYPE; prior_break bigint; used bigint; available bigint; event_break bigint; calculation_time timestamptz:=now();
BEGIN
 IF NOT public.upt_is_approved() THEN RAISE EXCEPTION 'ACCOUNT NOT APPROVED'; END IF;
 SELECT * INTO ws FROM public.work_sessions WHERE id=p_work_session;
 IF NOT FOUND THEN RAISE EXCEPTION 'Work session not found'; END IF;
 IF ws.user_id<>auth.uid() AND NOT public.upt_is_admin() AND NOT EXISTS(
 SELECT 1 FROM public.shifts s WHERE s.id=ws.shift_id AND public.upt_is_responsible(ws.event_id,s.workplace_id)) THEN
 RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT coalesce(sum(greatest(0,floor(extract(epoch from (least(coalesce(b.ended_at,calculation_time),coalesce(w.ended_at,calculation_time))-greatest(b.started_at,w.started_at)))))),0)::bigint
 INTO prior_break FROM public.break_sessions b JOIN public.work_sessions w ON w.id=b.work_session_id
 WHERE w.user_id=ws.user_id AND w.event_id=ws.event_id AND (w.started_at,w.id)<(ws.started_at,ws.id);
 SELECT coalesce(sum(greatest(0,floor(extract(epoch from (least(coalesce(b.ended_at,calculation_time),coalesce(ws.ended_at,calculation_time))-greatest(b.started_at,ws.started_at)))))),0)::bigint
 INTO used FROM public.break_sessions b WHERE b.work_session_id=ws.id;
 -- Event-wide tally: the ten-minute grace trigger can retroactively make
 -- a previous session's overage deductible if a later break crosses 70 min.
 SELECT coalesce(sum(greatest(0,floor(extract(epoch from (
  least(coalesce(b.ended_at,calculation_time),coalesce(w.ended_at,calculation_time))
  - greatest(b.started_at,w.started_at)
 ))))),0)::bigint INTO event_break
 FROM public.break_sessions b JOIN public.work_sessions w ON w.id=b.work_session_id
 WHERE w.user_id=ws.user_id AND w.event_id=ws.event_id;
 available:=greatest(3600-prior_break,0);
 work_session_id:=ws.id;
 gross_seconds:=greatest(0,floor(extract(epoch from(coalesce(ws.ended_at,calculation_time)-ws.started_at))))::bigint;
 break_seconds:=used; break_allowance_seconds:=3600;
 regular_break_seconds:=least(used,available); excess_break_seconds:=upt_private.break_deduction_seconds(prior_break,used,event_break)::bigint;
 break_balance_seconds:=greatest(available-used,0); net_payable_seconds:=greatest(gross_seconds-excess_break_seconds,0);
 active_break:=EXISTS(SELECT 1 FROM public.break_sessions b WHERE b.work_session_id=ws.id AND b.ended_at IS NULL);
 RETURN NEXT;
END $function$;
CREATE OR REPLACE FUNCTION upt_administration_private.payroll_rows(p_event uuid)
 RETURNS TABLE(session_id uuid, event_id uuid, event_name text, user_id uuid, full_name text, timesheet_status text, started_at timestamp with time zone, ended_at timestamp with time zone, gross_seconds numeric, break_seconds numeric, net_seconds numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then raise exception 'Administration required' using errcode='42501'; end if;
 if p_event is null or not exists(select 1 from public.events e where e.id=p_event) then raise exception 'Event unavailable'; end if;
 if exists(
  select 1 from public.work_sessions w join public.timesheets t on t.event_id=w.event_id and t.user_id=w.user_id
  where w.event_id=p_event and t.status in ('approved','locked')
  and (coalesce(w.ended_at,w.end_time) is null or coalesce(w.ended_at,w.end_time)<coalesce(w.started_at,w.start_time)
    or exists(select 1 from public.break_sessions b where b.work_session_id=w.id and (coalesce(b.ended_at,b.end_time) is null
     or coalesce(b.started_at,b.start_time)<coalesce(w.started_at,w.start_time)
     or coalesce(b.ended_at,b.end_time)>coalesce(w.ended_at,w.end_time)
     or coalesce(b.ended_at,b.end_time)<coalesce(b.started_at,b.start_time)))
    or exists(select 1 from public.break_sessions a join public.break_sessions b on a.work_session_id=b.work_session_id and a.id<b.id
     where a.work_session_id=w.id and coalesce(a.started_at,a.start_time)<coalesce(b.ended_at,b.end_time)
      and coalesce(b.started_at,b.start_time)<coalesce(a.ended_at,a.end_time)))
 ) then raise exception 'Approved time records require correction'; end if;
 -- All work sessions of a user's event (even non-approved) consume allowance.
 -- Preserve the existing approved/locked filters and correction guards.
 return query
 with all_sessions as (
   select w.id,w.user_id,w.event_id,coalesce(w.started_at,w.start_time) as started_at,
     coalesce((select sum(extract(epoch from (
       coalesce(bs.ended_at,bs.end_time)-coalesce(bs.started_at,bs.start_time)
     ))) from public.break_sessions bs where bs.work_session_id=w.id),0)::numeric as used
   from public.work_sessions w where w.event_id=p_event
 ), ranked as (
   select s.id,s.user_id,s.used,
     sum(s.used) over(partition by s.user_id) as total_used,
     coalesce(sum(s.used) over(partition by s.user_id
       order by s.started_at,s.id
       rows between unbounded preceding and 1 preceding),0)::numeric as prior_used
   from all_sessions s
 )
 select w.id,w.event_id,e.name,w.user_id,p.full_name,t.status,
   coalesce(w.started_at,w.start_time),coalesce(w.ended_at,w.end_time),
   extract(epoch from(coalesce(w.ended_at,w.end_time)-coalesce(w.started_at,w.start_time))),
   b.used,
   greatest(0,
     extract(epoch from(coalesce(w.ended_at,w.end_time)-coalesce(w.started_at,w.start_time)))
     - upt_private.break_deduction_seconds(b.prior_used,b.used,b.total_used)
   )
 from public.work_sessions w
 join ranked b on b.id=w.id
 join public.events e on e.id=w.event_id
 join public.profiles p on p.id=w.user_id
 join public.timesheets t on t.event_id=w.event_id and t.user_id=w.user_id
 where w.event_id=p_event and t.status in ('approved','locked')
 order by w.user_id,coalesce(w.started_at,w.start_time),w.id;
end $function$;
commit;
