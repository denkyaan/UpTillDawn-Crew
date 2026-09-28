import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { EventDocumentsPanel } from '@/components/crew/event-documents-panel'
import { OperationalChecklistPanel } from '@/components/crew/operational-checklists'
import { WorkplaceInventoryMaterials, type WorkplaceInventoryMaterial } from '@/components/crew/workplace-inventory-materials'

export const dynamic='force-dynamic'

type Workplace={
  id:string
  event_id:string
  name:string
  is_active:boolean
  events:{id:string;name:string;status:string;end_at:string}|null
}

export default async function InventoryPage(){
  const current=await getCurrentUser()
  if(!current)redirect('/login')
  const isAdmin=current.role==='admin'
  const isResponsible=current.role==='responsible_lead'
  const isStaff=current.role==='staff'
  if(!isAdmin&&!isResponsible&&!isStaff)redirect('/')

  const s=await createClient()
  let workplaces:Workplace[]=[]

  if(isAdmin){
    const {data,error}=await s
      .from('workplaces')
      .select('id,event_id,name,is_active,events(id,name,status,end_at)')
      .eq('is_active',true)
      .order('name')
    if(error)throw new Error('Inventaris kon niet worden geladen.')
    workplaces=(data||[]) as Workplace[]
  }else{
    const [{data:shiftRows},{data:responsibleRows}]=await Promise.all([
      s.from('shifts').select('event_id,workplace_id').eq('user_id',current.id).neq('status','cancelled').neq('response_status','declined'),
      s.from('responsible_assignments').select('event_id,workplace_id').eq('user_id',current.id),
    ])
    const workplaceIds=[...new Set([
      ...(shiftRows||[]).map(row=>row.workplace_id),
      ...(responsibleRows||[]).map(row=>row.workplace_id),
    ])]
    if(workplaceIds.length){
      const {data,error}=await s
        .from('workplaces')
        .select('id,event_id,name,is_active,events(id,name,status,end_at)')
        .in('id',workplaceIds)
        .eq('is_active',true)
        .order('name')
      if(error)throw new Error('Inventaris kon niet worden geladen.')
      workplaces=(data||[]) as Workplace[]
    }
  }

  const visible=isAdmin
    ? workplaces
    : workplaces.filter(workplace=>workplace.events&&workplace.events.status!=='archived')
  const workplaceIds=visible.map(workplace=>workplace.id)
  const materialResult=workplaceIds.length
    ? await s.from('inventory_items')
        .select('id,workplace_id,name,category,total_quantity,available_quantity,issued_quantity,damaged_quantity,missing_quantity')
        .in('workplace_id',workplaceIds)
        .eq('is_active',true)
        .order('category')
        .order('name')
    : {data:[],error:null}
  if(materialResult.error)throw new Error('Materialen konden niet worden geladen.')
  const materials=(materialResult.data||[]) as WorkplaceInventoryMaterial[]

  const options=visible.map(workplace=>({
    id:workplace.id,
    eventId:workplace.event_id,
    label:`${workplace.events?.name||'Evenement'} — ${workplace.name}`,
  }))

  return <main className="space-y-6 p-4 pb-28 md:p-8">
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">WERKPLEKINVENTARIS</p>
      <h1 className="text-3xl font-black">Inventaris</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isAdmin
          ? 'Beheer per werkplek foto’s, documenten, tekst en operationele checklists.'
          : 'Bekijk de inventaris en informatie van je toegewezen werkplek.'}
      </p>
    </div>

    {!visible.length&&<p className="rounded-2xl border p-5 text-muted-foreground">Geen toegewezen werkplek met inventaris beschikbaar.</p>}

    {visible.map(workplace=><section key={workplace.id} className="space-y-4 rounded-3xl border p-4 md:p-5">
      <div>
        <h2 className="text-2xl font-black">{workplace.name}</h2>
        <p className="text-sm text-muted-foreground">{workplace.events?.name}</p>
      </div>

      <WorkplaceInventoryMaterials
        workplaceId={workplace.id}
        workplaceName={workplace.name}
        materials={materials.filter(item=>item.workplace_id===workplace.id)}
        isAdmin={isAdmin}
        isResponsible={isResponsible}
      />

      <EventDocumentsPanel
        eventId={workplace.event_id}
        workplaceId={workplace.id}
        canManage={isAdmin}
        allowEventWide={false}
        showTextEntry={isAdmin}
        workplaceOptions={[{id:workplace.id,label:workplace.name}]}
      />
    </section>)}

    {(isAdmin||isResponsible)&&options.length>0&&<OperationalChecklistPanel
      userId={current.id}
      canManage={isAdmin}
      canClose={isAdmin||isResponsible}
      workplaceOptions={options}
      kinds={['opening','closing']}
    />}
  </main>
}
