-- Execute the actual stored CHECK expression against valid and invalid object keys.
do $$declare expression text;candidate text;matches boolean;prefix text:='a0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000001';begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint where conrelid='public.admin_financial_attachments'::regclass and conname='admin_financial_attachment_path';
 if expression is null then raise exception 'Financial attachment path constraint missing';end if;
 foreach candidate in array array[prefix||'.pdf',prefix||'.jpg',prefix||'.png',prefix||'.webp'] loop
  execute 'select '||expression||' from (select $1::text as storage_path) candidate' into matches using candidate;
  if matches is distinct from true then raise exception 'Valid financial attachment path rejected: %',candidate;end if;
 end loop;
 foreach candidate in array array[prefix||'Xpdf',prefix||'.exe',prefix||'.png/extra',prefix||'.png.exe','../'||prefix||'.pdf',replace(prefix,'/','//')||'.png',replace(prefix,'-','')||'.png'] loop
  execute 'select '||expression||' from (select $1::text as storage_path) candidate' into matches using candidate;
  if matches is distinct from false then raise exception 'Invalid financial attachment path accepted: %',candidate;end if;
 end loop;
 raise notice 'PASS: financial attachment CHECK accepts supported UUID paths and rejects malformed keys';
end;$$;
