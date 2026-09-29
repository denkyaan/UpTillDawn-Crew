import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { EventDocumentsPanel } from '@/components/crew/event-documents-panel'
import { PlatformAiAssistant } from '@/components/admin/platform-ai-assistant'
import { WorkplaceInventoryMaterials, type WorkplaceInventoryMaterial } from '@/components/crew/workplace-inventory-materials'
import {
  WorkplaceCatalogInventory,
  type CatalogItem,
  type CatalogWorkplace,
} from '@/components/crew/workplace-catalog-inventory'

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

  let catalogWorkplaces:CatalogWorkplace[]=[]
  let catalogItems:CatalogItem[]=[]
  let catalogLoadError=false
  let workplaceLoadError=false
  let materialLoadError=false
  if(isAdmin){
    const [{data:catalog,error:catalogError},{data:items,error:itemError}]=await Promise.all([
      s.from('workplace_catalog')
        .select('id,name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff')
        .order('sort_order')
        .order('name'),
      s.from('workplace_catalog_items')
        .select('id,catalog_workplace_id,name,category,default_quantity,is_active')
        .order('category')
        .order('name'),
    ])
    catalogLoadError=Boolean(catalogError||itemError)
    catalogWorkplaces=(catalog||[]) as CatalogWorkplace[]
    catalogItems=(items||[]) as CatalogItem[]
  }

  let workplaces:Workplace[]=[]
  if(isAdmin){
    const {data,error}=await s
      .from('workplaces')
      .select('id,event_id,name,is_active,events(id,name,status,end_at)')
      .eq('is_active',true)
      .order('name')
    workplaceLoadError=Boolean(error)
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
      workplaceLoadError=Boolean(error)
      workplaces=(data||[]) as Workplace[]
    }
  }

  const visible=workplaces.filter(workplace=>workplace.events&&workplace.events.status!=='archived')
  const workplaceIds=visible.map(workplace=>workplace.id)
  const materialResult=workplaceIds.length
    ? await s.from('inventory_items')
        .select('id,workplace_id,name,category,total_quantity,available_quantity,issued_quantity,damaged_quantity,missing_quantity')
        .in('workplace_id',workplaceIds)
        .eq('is_active',true)
        .order('category')
        .order('name')
    : {data:[],error:null}
  materialLoadError=Boolean(materialResult.error)
  const materials=(materialResult.data||[]) as WorkplaceInventoryMaterial[]


  return <main className="space-y-6 p-4 pb-28 md:p-8">
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">WERKPLEKINVENTARIS</p>
      <h1 className="text-3xl font-black">Inventaris</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isAdmin
          ? 'Beheer standaardwerkplekken vooraf en eventinventaris per werkplek.'
          : 'Bekijk de inventaris en informatie van je toegewezen werkplek.'}
      </p>
    </div>

    {catalogLoadError&&<p className="rounded-2xl border border-amber-500/40 p-4 text-sm text-amber-600">Standaardinventaris kon tijdelijk niet volledig worden geladen. Vernieuw de pagina om opnieuw te proberen.</p>}
    {workplaceLoadError&&<p className="rounded-2xl border border-amber-500/40 p-4 text-sm text-amber-600">Eventwerkplekken konden tijdelijk niet volledig worden geladen.</p>}
    {materialLoadError&&<p className="rounded-2xl border border-amber-500/40 p-4 text-sm text-amber-600">Materialen konden tijdelijk niet volledig worden geladen.</p>}

    {isAdmin&&<PlatformAiAssistant contextKey="inventory" contextLabel="Inventory"/>}
    {isAdmin&&<WorkplaceCatalogInventory workplaces={catalogWorkplaces} items={catalogItems}/>} 

    {!visible.length&&<p className="rounded-2xl border p-5 text-muted-foreground">
      {isAdmin
        ? 'Nog geen evenementwerkplekken. De standaardwerkplekken hierboven blijven altijd beschikbaar en worden automatisch naar nieuwe evenementen gekopieerd.'
        : 'Geen toegewezen werkplek met inventaris beschikbaar.'}
    </p>}

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

  </main>
}
