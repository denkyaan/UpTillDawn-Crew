-- Add an explicit authorization primitive to the public unread-total entry point.

create or replace function public.upt_chat_unread_total()
returns bigint
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_total bigint;
begin
  if v_actor is null or not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  select coalesce(sum(x.unread_count),0)::bigint
  into v_total
  from public.upt_chat_channel_summaries() x;

  return coalesce(v_total,0);
end;
$$;

revoke all on function public.upt_chat_unread_total() from public,anon;
grant execute on function public.upt_chat_unread_total() to authenticated;

notify pgrst,'reload schema';
