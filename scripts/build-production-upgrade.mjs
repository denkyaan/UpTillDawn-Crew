import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const sha=value=>createHash('sha256').update(value).digest('hex')
const literal=value=>"'"+value.replaceAll("'","''")+"'"

export function productionUpgrade({root=repository,plan:providedPlan}={}){
 const plan=providedPlan??JSON.parse(readFileSync(resolve(root,'supabase/upgrades/production-platform-plan.json'),'utf8'))
 if(![plan.baselineVersion,plan.localBaselineVersion,plan.targetVersion].every(value=>/^\d{14}$/.test(value))||plan.baselineVersion>plan.localBaselineVersion||plan.localBaselineVersion>plan.targetVersion)throw Error('Invalid upgrade version range')
 const orderedNames=plan.migrations.map(row=>row.file)
 if(JSON.stringify(orderedNames)!==JSON.stringify([...orderedNames].sort()))throw Error('Upgrade migrations must retain chronological order')
 const all=[...plan.migrations,...plan.excluded]
 const names=all.map(row=>row.file)
 if(new Set(names).size!==names.length)throw Error('Upgrade plan has duplicate source entries')
 const sourceNames=readdirSync(resolve(root,'supabase/migrations')).filter(name=>/^\d{14}_[a-z0-9_]+\.sql$/.test(name)&&name.slice(0,14)>plan.baselineVersion&&name.slice(0,14)<=plan.targetVersion).sort()
 if(JSON.stringify([...names].sort())!==JSON.stringify(sourceNames))throw Error('Upgrade plan does not account for every source migration')
 const contents=new Map()
 for(const entry of all){
  if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(entry.file))throw Error('Unsafe migration filename')
  const content=readFileSync(resolve(root,'supabase/migrations',entry.file),'utf8')
  if(sha(content)!==entry.sha256)throw Error('Reviewed migration changed: '+entry.file)
  contents.set(entry.file,content)
 }
 if(plan.alignment.file!=='core-function-alignment.sql')throw Error('Unexpected core alignment source')
 const alignment=readFileSync(resolve(root,'supabase/upgrades',plan.alignment.file),'utf8')
 if(sha(alignment)!==plan.alignment.sha256)throw Error('Reviewed core function alignment changed')
 if(!/^[a-f0-9]{32}$/.test(plan.columnContract)||!plan.newTables.every(name=>/^[a-z_]+$/.test(name)))throw Error('Invalid baseline contract')
 const required=plan.newTables.map(literal).join(',')
 let sql=`-- Reviewed platform upgrade: ${plan.baselineVersion} -> ${plan.targetVersion}.
-- Apply with a transaction (the Supabase migration API does this automatically).
-- No training schemas, historical QA deletion or user/provider secrets included.
do $upt_platform_upgrade$
declare v_existing integer;v_columns text;v_version text;
begin
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended('uptilldawn/platform-upgrade-20261108',0));
 select count(*) into v_existing from unnest(array[${required}]) as t(name) where to_regclass('public.'||t.name) is not null;
 if v_existing=${plan.newTables.length}
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='promotion_only')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='admin_payment_reminders' and column_name='revision')
  and exists(select 1 from pg_constraint where conrelid=to_regclass('public.admin_financial_attachments') and conname='admin_financial_attachment_path' and position('[.]' in pg_get_constraintdef(oid))>0) then
  raise notice 'Platform schema already present; upgrade skipped';return;
 end if;
 if v_existing<>0 then raise exception 'Partial platform installation requires a separate reviewed upgrade';end if;
 select max(version) into v_version from supabase_migrations.schema_migrations;
 if v_version is null or v_version not in (${literal(plan.baselineVersion)},${literal(plan.localBaselineVersion)}) then raise exception 'Unexpected production baseline: %',v_version;end if;
 select md5(string_agg(c.relname||'.'||a.attname||':'||nt.nspname||'.'||t.typname||':'||a.atttypmod::text||':'||a.attnotnull::text,E'\\n' order by c.relname,a.attname)) into v_columns
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
 join pg_type t on t.oid=a.atttypid join pg_namespace nt on nt.oid=t.typnamespace
 where n.nspname='public' and c.relkind in ('r','p');
 if v_columns is distinct from ${literal(plan.columnContract)} then raise exception 'Production column contract changed: %',v_columns;end if;
 if to_regclass('upt_private.app_owners') is null or to_regprocedure('cron.schedule(text,text,text)') is null then raise exception 'Required production dependencies are absent';end if;
`
 for(const [index,entry] of plan.migrations.entries()){
  const content=contents.get(entry.file),delimiter='$upt_source_'+index+'$'
  if(content.includes(delimiter))throw Error('SQL delimiter collision')
  sql+='\n -- '+entry.file+'\n execute '+delimiter+'\n'+content+'\n'+delimiter+';\n'
 }
 const delimiter='$upt_core_alignment$'
 if(alignment.includes(delimiter))throw Error('Alignment delimiter collision')
 sql+='\n execute '+delimiter+'\n'+alignment+'\n'+delimiter+';\n'
 sql+=` if exists(select 1 from unnest(array[${required}]) as t(name) where to_regclass('public.'||t.name) is null) then raise exception 'Platform upgrade incomplete';end if;
 perform pg_notify('pgrst','reload schema');
end;
$upt_platform_upgrade$;
`
 return {sql,plan,sha256:sha(sql)}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const output=process.argv[2]
 if(!output)throw Error('Supply an output SQL path; this command never connects to a database')
 const result=productionUpgrade()
 writeFileSync(output,result.sql)
 console.log(JSON.stringify({output,migrations:result.plan.migrations.length,excluded:result.plan.excluded.length,sha256:result.sha256}))
}
