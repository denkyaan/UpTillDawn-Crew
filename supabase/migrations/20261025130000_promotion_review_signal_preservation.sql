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
