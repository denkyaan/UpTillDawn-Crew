import { createClient } from '@/lib/supabase/crew-server'
import {
  cancelInventorySettlement,
  createInventoryItem,
  decideInventorySettlement,
  issueInventoryItem,
  requestInventorySettlement,
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

function conditionLabel(condition:string){
  if(condition==='returned')return 'TERUGGEBRACHT'
  if(condition==='damaged')return 'BESCHADIGD'
  return 'VERMIST'
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
  const [itemResult,issueResult,movementResult,requestResult]=await Promise.all([
    s.from('inventory_items').select('*').eq('is_active',true).order('name'),
    s.from('inventory_issues').select('*').order('issued_at',{ascending:false}).limit(200),
    s.from('inventory_movements').select('*').order('created_at',{ascending:false}).limit(canManage?20:10),
    s.from('inventory_settlement_requests').select('*').order('created_at',{ascending:false}).limit(100),
  ])

  if(itemResult.error||issueResult.error||movementResult.error||requestResult.error){
    return <section className="rounded-2xl border p-4">
      <h2 className="text-xl font-black">Materiaal</h2>
      <p className="mt-2 text-sm text-muted-foreground">Materiaalgegevens konden niet worden geladen.</p>
    </section>
  }

  const items=(itemResult.data||[]) as Tables<'inventory_items'>[]
  const issues=(issueResult.data||[]) as Tables<'inventory_issues'>[]
  const movements=(movementResult.data||[]) as Tables<'inventory_movements'>[]
  const requests=(requestResult.data||[]) as Tables<'inventory_settlement_requests'>[]
  const itemsById=new Map(items.map(item=>[item.id,item]))
  const issuesById=new Map(issues.map(issue=>[issue.id,issue]))
  const workplaceById=new Map(workplaceOptions.map(option=>[option.id,option.label]))
  const crewById=new Map(crewOptions.map(option=>[option.userId,option.fullName]))
  const ownOpenIssues=issues.filter(issue=>issue.user_id===userId&&issue.outstanding_quantity>0)
  const managerOpenIssues=issues.filter(issue=>issue.outstanding_quantity>0)
  const pendingRequests=requests.filter(request=>request.status==='pending')
  const pendingByIssue=new Map(pendingRequests.map(request=>[request.issue_id,request]))
  const ownRecentRequests=requests.filter(request=>request.user_id===userId&&request.status!=='pending').slice(0,5)

  if(!canManage&&!ownOpenIssues.length&&!ownRecentRequests.length){
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
          ? 'Voorraad en uitgiftes per werkplek. Retourmeldingen van personeel moeten eerst bevestigd worden voordat voorraad opnieuw beschikbaar wordt.'
          : 'Meld materiaal als teruggebracht, beschadigd of vermist. De voorraad wordt pas aangepast na bevestiging door Responsible of Admin.'}
      </p>
    </div>

    {canManage&&pendingRequests.length>0&&<section className="space-y-3 rounded-xl border border-violet-500/40 bg-violet-500/5 p-3">
      <h3 className="font-black">Te beoordelen materiaalmeldingen ({pendingRequests.length})</h3>
      {pendingRequests.map(request=>{
        const issue=issuesById.get(request.issue_id)
        const item=issue?itemsById.get(issue.item_id):null
        return <article key={request.id} className="space-y-3 rounded-lg border bg-background p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{item?.name||'Materiaal'} · {crewById.get(request.user_id)||'Personeelslid'}</p>
              <p className="text-sm text-muted-foreground">{conditionLabel(request.condition)} · {request.quantity} stuk(s) · gemeld {new Date(request.created_at).toLocaleString('nl-BE')}</p>
              {request.notes&&<p className="mt-1 text-sm text-muted-foreground">{request.notes}</p>}
            </div>
            <span className="rounded-full border px-2 py-1 text-xs font-black">WACHT OP CONTROLE</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <form action={decideInventorySettlement}>
              <input type="hidden" name="request_id" value={request.id}/>
              <input type="hidden" name="decision" value="approved"/>
              <button className="w-full rounded-lg bg-emerald-600 p-3 font-bold text-white">BEVESTIGEN</button>
            </form>
            <form action={decideInventorySettlement} className="grid gap-2">
              <input type="hidden" name="request_id" value={request.id}/>
              <input type="hidden" name="decision" value="rejected"/>
              <input name="note" required minLength={3} maxLength={1000} placeholder="Reden afwijzing" className="rounded-lg border bg-background p-2"/>
              <button className="rounded-lg border border-red-500/50 p-3 font-bold text-red-600">AFWIJZEN</button>
            </form>
          </div>
        </article>
      })}
    </section>}

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

          {itemIssues.length>0&&<details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">Uitstaand ({itemIssues.reduce((sum,issue)=>sum+issue.outstanding_quantity,0)})</summary>
            <div className="mt-3 space-y-3">
              {itemIssues.map(issue=><IssueSettlement
                key={issue.id}
                issue={issue}
                itemName={item.name}
                personName={crewById.get(issue.user_id)||'Personeelslid'}
                canManage
                pendingRequest={pendingByIssue.get(issue.id)||null}
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
          canManage={false}
          pendingRequest={pendingByIssue.get(issue.id)||null}
        />
      })}
    </div>}

    {!canManage&&ownRecentRequests.length>0&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Recente materiaalmeldingen</summary>
      <div className="mt-3 space-y-2">
        {ownRecentRequests.map(request=>{
          const issue=issuesById.get(request.issue_id)
          const item=issue?itemsById.get(issue.item_id):null
          return <div key={request.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{item?.name||'Materiaal'} · {conditionLabel(request.condition)} · {request.quantity}</span>
              <span className="font-black">{request.status==='approved'?'BEVESTIGD':request.status==='rejected'?'AFGEWEZEN':'GEANNULEERD'}</span>
            </div>
            {request.decision_note&&<p className="mt-1 text-muted-foreground">{request.decision_note}</p>}
          </div>
        })}
      </div>
    </details>}

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
  canManage,
  pendingRequest,
}:{
  issue:Tables<'inventory_issues'>
  itemName:string
  personName:string
  canManage:boolean
  pendingRequest:Tables<'inventory_settlement_requests'>|null
}){
  const action=canManage?settleInventoryIssue:requestInventorySettlement

  return <article className="rounded-lg border p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-semibold">{itemName} · {personName}</p>
        <p className="text-sm text-muted-foreground">Uitstaand: {issue.outstanding_quantity}/{issue.quantity} · uitgegeven {new Date(issue.issued_at).toLocaleString('nl-BE')}</p>
        {issue.notes&&<p className="mt-1 text-sm text-muted-foreground">{issue.notes}</p>}
      </div>
      <span className="rounded-full border px-2 py-1 text-xs font-black">UITSTAAND</span>
    </div>

    {pendingRequest
      ? <div className="mt-3 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-semibold">Melding wacht op controle: {conditionLabel(pendingRequest.condition)} · {pendingRequest.quantity} stuk(s)</p>
          {pendingRequest.notes&&<p className="text-muted-foreground">{pendingRequest.notes}</p>}
          {!canManage&&<form action={cancelInventorySettlement}>
            <input type="hidden" name="request_id" value={pendingRequest.id}/>
            <button className="rounded-lg border px-3 py-2 font-bold">MELDING ANNULEREN</button>
          </form>}
        </div>
      : <form action={action} className="mt-3 grid gap-2">
          <input type="hidden" name="issue_id" value={issue.id}/>
          <div className="grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
            <input name="quantity" type="number" min="1" max={issue.outstanding_quantity} defaultValue={issue.outstanding_quantity} required aria-label="Aantal verwerken" className="rounded-lg border bg-background p-2"/>
            <input name="notes" maxLength={1000} placeholder="Notitie (optioneel)" className="rounded-lg border bg-background p-2"/>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button name="condition" value="returned" className="rounded-lg border p-3 font-bold">{canManage?'TERUGBOEKEN':'RETOUR MELDEN'}</button>
            <button name="condition" value="damaged" className="rounded-lg border border-amber-500/50 p-3 font-bold text-amber-600">{canManage?'BESCHADIGD BOEKEN':'BESCHADIGD MELDEN'}</button>
            <button name="condition" value="missing" className="rounded-lg border border-red-500/50 p-3 font-bold text-red-600">{canManage?'VERMIST BOEKEN':'VERMIST MELDEN'}</button>
          </div>
          {!canManage&&<p className="text-xs text-muted-foreground">Je melding verandert de voorraad pas nadat Responsible of Admin ze bevestigt.</p>}
        </form>}
  </article>
}
