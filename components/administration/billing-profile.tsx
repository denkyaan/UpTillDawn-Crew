import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationPageAccess} from '@/lib/administration/page-access'
import {billingParty,billingFields} from '@/lib/administration/peppol-server'
import {peppolPartyIssues,normalizeEnterprise} from '@/lib/administration/peppol'
import {requestUiLocale} from '@/lib/server-locale'
import {peppolCopy,peppolFieldLabels,localeIndex} from '@/lib/administration/peppol-copy'

const path='/portals/administration/modules/settings'
const fieldLengths={name:200,street_address:300,postal_code:32,city:120,country_code:2,enterprise_number:50,vat_number:50,tax_registration:100,peppol_endpoint:200,iban:34} as const
async function save(form:FormData){
 'use server'
 const access=await administrationPageAccess()
 if(!access.ok)redirect(path+'?billing=error')
 const db=access.db as unknown as SupabaseClient
 const values=Object.fromEntries(billingFields.map(key=>[key,String(form.get(key)??'').trim()]))
 if(Object.values(values).some(value=>value.length>300||/[\u0000-\u001f]/.test(value)))redirect(path+'?billing=error')
 values.country_code=values.country_code.toUpperCase()
 values.enterprise_number=normalizeEnterprise(values.enterprise_number,values.country_code)
 values.vat_number=values.vat_number.replace(/[.\s-]/g,'').toUpperCase()
 values.iban=values.iban.replace(/\s/g,'').toUpperCase()
 const {data:existing,error}=await db.from('admin_billing_profile').select('updated_at').eq('singleton',true).maybeSingle()
 if(error||String(existing?.updated_at??'')!==String(form.get('version')??''))redirect(path+'?billing=error')
 const result=existing?await db.from('admin_billing_profile').update(values).eq('singleton',true).eq('updated_at',existing.updated_at).select('singleton'):await db.from('admin_billing_profile').insert({...values,singleton:true}).select('singleton')
 if(result.error||result.data?.length!==1)redirect(path+'?billing=error')
 revalidatePath(path)
}
async function approve(form:FormData){
 'use server'
 const access=await administrationPageAccess()
 if(!access.ok||(!access.user.isAdmin&&!access.user.isOwner))redirect(path+'?billing=error')
 const db=access.db as unknown as SupabaseClient
 const {data:profile,error}=await db.from('admin_billing_profile').select('*').eq('singleton',true).maybeSingle()
 if(error||!profile||profile.updated_at!==form.get('version')||peppolPartyIssues(billingParty(profile),'seller').length)redirect(path+'?billing=error')
 const {data,error:updateError}=await db.from('admin_billing_profile').update({approved_by:access.user.id,approved_at:new Date().toISOString()}).eq('singleton',true).eq('updated_at',profile.updated_at).select('singleton')
 if(updateError||data?.length!==1)redirect(path+'?billing=error')
 revalidatePath(path)
}
export default async function BillingProfile({failed=false}:{failed?:boolean}){
 const access=await administrationPageAccess()
 if(!access.ok)return null
 const {data:profile,error}=await (access.db as unknown as SupabaseClient).from('admin_billing_profile').select('*').eq('singleton',true).maybeSingle()
 const locale=await requestUiLocale(),t=peppolCopy[locale],index=localeIndex[locale]
 if(error)return <p role="alert" className="p-5">{t.error}</p>
 const party=billingParty(profile)
 const issues=peppolPartyIssues(party,'seller')
 return <section aria-label={t.company} className="mx-auto mb-8 max-w-6xl space-y-4 rounded-xl border bg-card p-5">
  <h2 className="text-xl font-semibold">{t.company}</h2><p role="status">{profile?.approved_at?t.approved:t.unapproved}</p><p className="text-sm text-muted-foreground">{t.changed}</p>
  {failed&&<p role="alert" className="text-red-400">{t.conflict}</p>}
  <form action={save} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="version" value={profile?.updated_at??''}/>
   {billingFields.map(key=><label key={key} className="space-y-1 text-sm">{peppolFieldLabels[key][index]}<input name={key} defaultValue={party[key]||((key==='country_code')?'BE':'')} maxLength={fieldLengths[key]} placeholder={key==='peppol_endpoint'?'0208:0123456749':undefined} className="block w-full rounded-lg border bg-background p-3"/></label>)}
   <button type="submit" className="rounded-lg bg-violet-600 px-4 py-3 text-white">{t.save}</button>
  </form>
  {profile&&!profile.approved_at&&issues.length>0&&<ul className="list-disc pl-5 text-sm">{issues.map((issue,i)=><li key={i}>{peppolFieldLabels[issue.path.split('.').at(-1) as keyof typeof peppolFieldLabels]?.[index]??t.company}: {t[issue.code]}</li>)}</ul>}
  {profile&&!profile.approved_at&&(access.user.isAdmin||access.user.isOwner)&&<form action={approve}><input type="hidden" name="version" value={profile.updated_at}/><button disabled={issues.length>0} type="submit" className="rounded-lg border border-violet-500 px-4 py-3 disabled:opacity-50">{t.approve}</button></form>}
 </section>
}
