import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'

export const dynamic='force-dynamic'

export default async function AuditPage(){
 const current=await getCurrentUser()
 if(!current?.isAdmin)redirect('/')
 const s=await createClient()
 const {data,error}=await s
  .from('upt_audit_logs')
  .select('id,actor_id,action,entity_type,entity_id,metadata,created_at')
  .order('created_at',{ascending:false})
  .limit(250)
 const rows=data||[]
 const actorIds=[...new Set(rows.map(row=>row.actor_id).filter(Boolean))]
 const {data:profiles}=actorIds.length
  ? await s.from('profiles').select('id,full_name').in('id',actorIds)
  : {data:[]}
 const names=new Map((profiles||[]).map(row=>[row.id,row.full_name||'Gebruiker']))

 return <main className="mx-auto max-w-7xl space-y-5 p-4 pb-28 md:p-8">
  <header>
   <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">AUDIT TRAIL</p>
   <h1 className="text-3xl font-black">Wijzigingslog</h1>
   <p className="text-sm text-muted-foreground">Wie wijzigde wat, wanneer en op welk object. Metadata bewaart de beschikbare oude/nieuwe context per actie.</p>
  </header>
  {error&&<p className="rounded-xl border border-amber-500/40 p-4 text-amber-600">Auditlog kon tijdelijk niet volledig worden geladen.</p>}
  {!rows.length
   ? <p className="rounded-xl border p-4 text-muted-foreground">Nog geen auditregels beschikbaar.</p>
   : <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[900px] text-left text-sm">
       <thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="p-3">Tijd</th><th className="p-3">Gebruiker</th><th className="p-3">Actie</th><th className="p-3">Object</th><th className="p-3">Details</th></tr></thead>
       <tbody>{rows.map(row=><tr key={row.id} className="border-b align-top last:border-0">
        <td className="p-3 whitespace-nowrap">{new Date(row.created_at).toLocaleString('nl-BE')}</td>
        <td className="p-3">{row.actor_id?names.get(row.actor_id)||row.actor_id:'Systeem'}</td>
        <td className="p-3 font-semibold">{row.action}</td>
        <td className="p-3">{row.entity_type}<div className="text-xs text-muted-foreground">{row.entity_id||''}</div></td>
        <td className="max-w-xl p-3"><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(row.metadata??{},null,2)}</pre></td>
       </tr>)}</tbody>
      </table>
     </div>}
 </main>
}
