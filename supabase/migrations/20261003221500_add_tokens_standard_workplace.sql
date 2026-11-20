insert into public.workplace_catalog(name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff)
select 'Tokens','Tokenverkoop, tokenkassa en uitgifte.',35,true,0,0,null
where not exists (select 1 from public.workplace_catalog where lower(name)='tokens');

update public.workplace_catalog
set sort_order=35,is_active=true,description='Tokenverkoop, tokenkassa en uitgifte.'
where lower(name)='tokens';
