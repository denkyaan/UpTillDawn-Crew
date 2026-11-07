import {pathToFileURL} from 'node:url'

const productionOrigin='https://eakoavcieossazqzplke.supabase.co'
const relations=[
 ['portal_role_assignments',['user_id','portal','approved']],
 ['admin_counterparties',['id','name','kind']],
 ['admin_financial_documents',['id','status','gross_amount','original_invoice_id','due_date','issue_date']],
 ['admin_financial_lines',['id','document_id','quantity','unit_price','vat_rate']],
 ['admin_payment_reminders',['id','document_id','status','revision']],
 ['admin_financial_payments',['id','document_id','amount','bank_reference']],
 ['admin_operational_obligations',['id','status','updated_at']],
 ['admin_inventory_receipts',['request_id','line_id','item_id','quantity']],
 ['admin_ticket_sales',['id','event_id','external_id','gross_cents','import_id']],
 ['admin_provider_event_mappings',['id','provider','event_id','external_event_id','enabled']],
]

/** Resolve columns without reading rows or requiring a privileged database key. */
export async function checkProductionSchema({url,key,fetcher=fetch}){
 const target=new URL(url)
 if(target.origin!==productionOrigin||target.pathname!=='/'||target.search||target.hash||target.username||target.password)throw Error('Production schema check requires the pinned production database')
 if(!key)throw Error('Production publishable key is missing')
 const checks=[],failed=[]
 async function inspect([table,columns]){
  const endpoint=new URL('/rest/v1/'+table,target)
  endpoint.searchParams.set('select',columns.join(','))
  endpoint.searchParams.set('limit','0')
  try{
   const response=await fetcher(endpoint,{method:'GET',headers:{apikey:key},redirect:'error',signal:AbortSignal.timeout(15000)})
   const body=await response.json()
   if(response.status===200&&Array.isArray(body)&&body.length===0)return {table,status:200,access:'empty'}
   // PostgreSQL resolves selected columns before checking table privileges.
   // This specific error proves the relation/columns resolved, while keeping
   // private finance rows inaccessible to the anonymous deployment probe.
   if([401,403].includes(response.status)&&body?.code==='42501'&&String(body.message).replaceAll('"','')==='permission denied for table '+table)return {table,status:response.status,access:'denied'}
   return {table,status:response.status,error:'HTTP '+response.status+' ('+(body?.code??'unexpected response')+')'}
  }catch{return {table,error:'Request or response validation failed'}}
 }
 for(let offset=0;offset<relations.length;offset+=4){
  const batch=await Promise.all(relations.slice(offset,offset+4).map(inspect))
  for(const result of batch){checks.push(result);if(result.error)failed.push(result.table+': '+result.error)}
 }
 if(failed.length)throw Error('Production administration schema is not ready:\n'+failed.join('\n'))
 return checks
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const checks=await checkProductionSchema({url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY})
  for(const check of checks)console.log('PASS schema:',check.table,'HTTP',check.status)
 }catch(error){console.error(error.message);process.exitCode=1}
}
