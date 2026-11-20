create or replace function public.upt_god_upload_security_audit(p_token text,p_limit integer default 100)
returns table(id uuid,bucket_id text,storage_path text,uploaded_by uuid,uploader_email text,uploader_name text,mime_type text,file_size_bytes bigint,risk_class text,status text,engine text,engine_result jsonb,attempts integer,scanned_at timestamptz,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='pg_catalog','public' as $$
begin
 if public.upt_god_session_valid(p_token) is distinct from true then raise exception 'Unauthorized'; end if;
 return query select s.id,s.bucket_id,s.storage_path,s.uploaded_by,u.email,coalesce(p.full_name,u.email),s.mime_type,s.file_size_bytes,s.risk_class,s.status,s.engine,s.engine_result,s.attempts,s.scanned_at,s.created_at,s.updated_at
 from public.upload_security_scans s left join auth.users u on u.id=s.uploaded_by left join public.profiles p on p.id=s.uploaded_by
 order by s.created_at desc limit least(greatest(coalesce(p_limit,100),1),500);
end $$;
revoke all on function public.upt_god_upload_security_audit(text,integer) from public,anon,authenticated;
grant execute on function public.upt_god_upload_security_audit(text,integer) to service_role;