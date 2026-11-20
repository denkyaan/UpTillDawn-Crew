begin;

do $$
declare
  v_responsible integer;
  v_staff integer;
begin
  v_responsible := upt_private.refresh_responsible_operational_automations();
  v_staff := upt_private.refresh_staff_operational_automations();

  if v_responsible is null or v_staff is null then
    raise exception 'operational automation runtime functions returned null';
  end if;
end;
$$;

rollback;
