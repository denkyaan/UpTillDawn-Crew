import { createClient } from '@/lib/supabase/crew-server'
import {
  createInventoryItem,
  issueInventoryItem,
  restockInventoryItem,
  restoreInventoryQuantity,
  settleInventoryIssue,
} from '@/lib/actions/uptilldawn'
import {
  canIssueInventory,
  inventoryAvailability,
  inventoryCountsAreValid,
} from '@/lib/inventory'
import type { Tables } from '@/types/crew-database'

export type InventoryWorkplaceOption={
  id:string
  eventId:string
  label:string
}

export type InventoryCrewOption={
  userId:string
  fullName:string
  workplaceId:string
}

function movementLabel(type:string){
  if(type==='created')return 'Aangemaakt'
  if(type==='restocked')return 'Bijgevuld'
  if(type==='issued')return 'Uitgegeven'
  if(type==='returned')return 'Teruggebracht'
  if(type==='damaged')return 'Beschadigd'
  if(type==='missing')return 'Vermist'
  if(type==='restored-damaged')return 'Hersteld'
  if(type==='restored-missing')return 'Teruggevonden'
  return type
}

export async function InventoryPanel({
  userId,
  canManage,
  workplaceOptions,
  crewOptions,
}:{
  userId:string
  canManage:boolean
  workplaceOptions:InventoryWorkplaceOption[]
  crewOptions:InventoryCrewOption[]
}){
  const s=await createClient()
  const [itemResult,issueResult,movementResult]=await Promise.all([
    s.from('inventory_items').select('*').eq('is_active',true).order('name'),
    s.from('inventory_issues').select('*').order('issued_at',{ascending:false}).limit(200),
    s.from('inventory_movements').select('*').order('created_at',{ascending:false}).limit(canManage?20:10),
  ])

  if(itemResult.error||issueResult.error||movementResult.error){
    return <section className="rounded-2xl border p-4">
      <h2 className="text-xl font-black">Materiaal</h2>
      <p className="mt-2 text-sm text-muted-foreground">Materiaalgegevens konden niet worden geladen.</p>
    </section>
  }

  const items=(itemResult.data||[]) as Tables<'inventory_items'>[]
  const issues=(issueResult.data||[]) as Tables<'inventory_issues'>[]
  const movements=(movementResult.data||[]) as Tables<'inventory_movements'>[]
  const itemsById=new Map(items.map(item=>[item.id,item]))
  const workplaceById=new Map(workplaceOptions.map(option=>[option.id,option.label]))
  const crewById=new Map(crewOptions.map(option=>[option.userId,option.fullName]))
  const ownOpenIssues=issues.filter(issue=>issue.user_id===userId&&issue.outstanding_quantity>0)
  const managerOpenIssues=issues.filter(issue=>issue.outstanding_quantity>0)

  if(!canManage&&!ownOpenIssues.length){
    return <section className="rounded-2xl border p-4">
      <h2 className="text-xl font-black">Mijn materiaal</h2>
      <p className="text-sm text-muted-foreground">Er staat momenteel geen materiaal op jouw naam.</p>
    </section>
  }

  return <section className="space-y-4 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-black">{canManage?'Materiaalbeheer':'Mijn materiaal'}</h2>
      <p className="text-sm text-muted-foreground">
        {canManage
          ? 'Voorraad en uitgiftes per werkplek. Beschadigd of vermist materiaal blijft zichtbaar tot het wordt hersteld of teruggevonden.'
          : 'Verwerk materiaal dat aan jou werd uitgegeven als teruggebracht, beschadigd of vermist.'}
      </p>
    </div>

    {canManage&&workplaceOptions.length>0&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Materiaal toevoegen</summary>
      <form action={createInventoryItem} className="mt-3 grid gap-2 md:grid-cols-2">
        <select name="workplace_id" required className="rounded-lg border bg-background p-3">
          <option value="">Werkplek…</option>
          {workplaceOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <input name="name" required maxLength={200} placeholder="Materiaalnaam" className="rounded-lg border bg-background p-3"/>
        <input name="category" maxLength={120} placeholder="Categorie (optioneel)" className="rounded-lg border bg-background p-3"/>
        <input name="quantity" type="number" min="1" max="100000" defaultValue="1" required className="rounded-lg border bg-background p-3"/>
        <button className="rounded-lg bg-violet-600 p-3 font-bold text-white md:col-span-2">MATERIAAL TOEVOEGEN</button>
      </form>
    </details>}

    {canManage&&items.length===0&&<p className="rounded-xl border p-4 text-sm text-muted-foreground">Nog geen materiaal geregistreerd.</p>}

    {canManage&&items.length>0&&<div className="grid gap-4 lg:grid-cols-2">
      {items.map(item=>{
        const model={
          id:item.id,
          name:item.name,
          category:item.category,
          totalQuantity:item.total_quantity,
          availableQuantity:item.available_quantity,
          issuedQuantity:item.issued_quantity,
          damagedQuantity:item.damaged_quantity,
          missingQuantity:item.missing_quantity,
          eventId:item.event_id,
          workplaceId:item.workplace_id,
        }
        const state=inventoryAvailability(model)
        const valid=inventoryCountsAreValid(model)
        const issueable=canIssueInventory(model)
        const itemIssues=managerOpenIssues.filter(issue=>issue.item_id===item.id)
        const eligibleCrew=crewOptions.filter(person=>person.workplaceId===item.workplace_id)

        return <article key={item.id} className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">{item.name}</h3>
              <p className="text-sm text-muted-foreground">{workplaceById.get(item.workplace_id)||'Werkplek'}{item.category?' · '+item.category:''}</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-xs font-black ${state==='empty'?'border-red-500/50 text-red-600':state==='low'?'border-amber-500/50 text-amber-600':'border-emerald-500/50 text-emerald-600'}`}>
              {state==='empty'?'LEEG':state==='low'?'LAGE VOORRAAD':'BESCHIKBAAR'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <div className="rounded-lg border p-2"><b>{item.available_quantity}</b><p className="text-xs text-muted-foreground">beschikbaar</p></div>
            <div className="rounded-lg border p-2"><b>{item.issued_quantity}</b><p className="text-xs text-muted-foreground">uitgegeven</p></div>
            <div className="rounded-lg border p-2"><b>{item.damaged_quantity}</b><p className="text-xs text-muted-foreground">beschadigd</p></div>
            <div className="rounded-lg border p-2"><b>{item.missing_quantity}</b><p className="text-xs text-muted-foreground">vermist</p></div>
            <div className="rounded-lg border p-2"><b>{item.total_quantity}</b><p className="text-xs text-muted-foreground">totaal</p></div>
          </div>

          {!valid&&<p className="rounded-lg border border-red-500/50 p-3 text-sm font-semibold text-red-600">Voorraadtelling is inconsistent. Nieuwe uitgifte is server-side beschermd; controleer de auditlog.</p>}

          {issueable&&eligibleCrew.length>0&&<details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">Uitgeven aan personeel</summary>
            <form action={issueInventoryItem} className="mt-3 grid gap-2">
              <input type="hidden" name="item_id" value={item.id}/>
              <select name="user_id" required className="rounded-lg border bg-background p-3">
                <option value="">Personeelslid…</option>
                {eligibleCrew.map(person=><option key={person.userId} value={person.userId}>{person.fullName}</option>)}
              </select>
              <input name="quantity" type="number" min="1" max={item.available_quantity} defaultValue="1" required className="rounded-lg border bg-background p-3"/>
              <input name="notes" maxLength={1000} placeholder="Notitie (optioneel)" className="rounded-lg border bg-background p-3"/>
              <button className="rounded-lg border p-3 font-bold">UITGEVEN</button>
            </form>
          </details>}

          <form action={restockInventoryItem} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[100px_minmax(0,1fr)_auto]">
            <input type="hidden" name="item_id" value={item.id}/>
            <input name="quantity" type="number" min="1" max="100000" defaultValue="1" required aria-label="Aantal bijvullen" className="rounded-lg border bg-background p-2"/>
            <input name="notes" maxLength={1000} placeholder="Notitie bij aanvulling" className="rounded-lg border bg-background p-2"/>
            <button className="rounded-lg border px-3 py-2 font-bold">BIJVULLEN</button>
          </form>

          {(item.damaged_quantity>0||item.missing_quantity>0)&&<div className="grid gap-2 sm:grid-cols-2">
            {item.damaged_quantity>0&&<form action={restoreInventoryQuantity} className="grid gap-2 rounded-lg border p-3">
              <input type="hidden" name="item_id" value={item.id}/>
              <input type="hidden" name="condition" value="damaged"/>
              <p className="text-sm font-semibold">{item.damaged_quantity} beschadigd</p>
              <input name="quantity" type="number" min="1" max={item.damaged_quantity} defaultValue="1" required className="rounded-lg border bg-background p-2"/>
              <input name="notes" maxLength={1000} placeholder="Herstelnotitie" className="rounded-lg border bg-background p-2"/>
              <button className="rounded-lg border px-3 py-2 font-bold">HERSTELD</button>
            </form>}
            {item.missing_quantity>0&&<form action={restoreInventoryQuantity} className="grid gap-2 rounded-lg border p-3">
              <input type="hidden" name="item_id" value={item.id}/>
              <input type="hidden" name="condition" value="missing"/>
              <p className="text-sm font-semibold">{item.missing_quantity} vermist</p>
              <input name="quantity" type="number" min="1" max={item.missing_quantity} defaultValue="1" required className="rounded-lg border bg-background p-2"/>
              <input name="notes" maxLength={1000} placeholder="Teruggevonden waar?" className="rounded-lg border bg-background p-2"/>
              <button className="rounded-lg border px-3 py-2 font-bold">TERUGGEVONDEN</button>
            </form>}
          </div>}

          {itemIssues.length>0&&<details className="rounded-lg border p-3" open={itemIssues.some(issue=>issue.outstanding_quantity>0)}>
            <summary className="cursor-pointer text-sm font-semibold">Uitstaand ({itemIssues.reduce((sum,issue)=>sum+issue.outstanding_quantity,0)})</summary>
            <div className="mt-3 space-y-3">
              {itemIssues.map(issue=><IssueSettlement
                key={issue.id}
                issue={issue}
                itemName={item.name}
                personName={crewById.get(issue.user_id)||'Personeelslid'}
              />)}
            </div>
          </details>}
        </article>
      })}
    </div>}

    {!canManage&&<div className="space-y-3">
      {ownOpenIssues.map(issue=>{
        const item=itemsById.get(issue.item_id)
        return <IssueSettlement
          key={issue.id}
          issue={issue}
          itemName={item?.name||'Materiaal'}
          personName="Jij"
        />
      })}
    </div>}

    {movements.length>0&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Recente materiaalmutaties</summary>
      <div className="mt-3 space-y-2">
        {movements.map(movement=>{
          const item=itemsById.get(movement.item_id)
          return <div key={movement.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-semibold">{item?.name||'Materiaal'} · {movementLabel(movement.movement_type)}</p>
              {movement.notes&&<p className="text-muted-foreground">{movement.notes}</p>}
            </div>
            <div className="text-right">
              <b>{movement.quantity}</b>
              <p className="text-xs text-muted-foreground">{new Date(movement.created_at).toLocaleString('nl-BE')}</p>
            </div>
          </div>
        })}
      </div>
    </details>}
  </section>
}

function IssueSettlement({
  issue,
  itemName,
  personName,
}:{
  issue:Tables<'inventory_issues'>
  itemName:string
  personName:string
}){
  return <article className="rounded-lg border p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-semibold">{itemName} · {personName}</p>
        <p className="text-sm text-muted-foreground">Uitstaand: {issue.outstanding_quantity}/{issue.quantity} · uitgegeven {new Date(issue.issued_at).toLocaleString('nl-BE')}</p>
        {issue.notes&&<p className="mt-1 text-sm text-muted-foreground">{issue.notes}</p>}
      </div>
      <span className="rounded-full border px-2 py-1 text-xs font-black">UITSTAAND</span>
    </div>
    <form action={settleInventoryIssue} className="mt-3 grid gap-2">
      <input type="hidden" name="issue_id" value={issue.id}/>
      <div className="grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
        <input name="quantity" type="number" min="1" max={issue.outstanding_quantity} defaultValue={issue.outstanding_quantity} required aria-label="Aantal verwerken" className="rounded-lg border bg-background p-2"/>
        <input name="notes" maxLength={1000} placeholder="Notitie (optioneel)" className="rounded-lg border bg-background p-2"/>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <button name="condition" value="returned" className="rounded-lg border p-3 font-bold">TERUGGEBRACHT</button>
        <button name="condition" value="damaged" className="rounded-lg border border-amber-500/50 p-3 font-bold text-amber-600">BESCHADIGD</button>
        <button name="condition" value="missing" className="rounded-lg border border-red-500/50 p-3 font-bold text-red-600">VERMIST</button>
      </div>
    </form>
  </article>
}
