import {
  createInventoryItem,
  reportWorkplaceInventoryCondition,
  restockInventoryItem,
  restoreInventoryQuantity,
} from '@/lib/actions/uptilldawn'

export type WorkplaceInventoryMaterial={
  id:string
  workplace_id:string
  name:string
  category:string|null
  total_quantity:number
  available_quantity:number
  issued_quantity:number
  damaged_quantity:number
  missing_quantity:number
}

function ConditionForm({
  item,
  phase,
}:{
  item:WorkplaceInventoryMaterial
  phase:'opening'|'closing'
}){
  const empty=item.available_quantity<1
  return <form action={reportWorkplaceInventoryCondition} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[150px_90px_minmax(0,1fr)_auto]">
    <input type="hidden" name="item_id" value={item.id}/>
    <input type="hidden" name="phase" value={phase}/>
    <select name="condition" required defaultValue="missing" disabled={empty} className="rounded-lg border bg-background p-2">
      <option value="missing">Ontbreekt</option>
      <option value="damaged">Kapot</option>
    </select>
    <input name="quantity" type="number" min="1" max={Math.max(1,item.available_quantity)} defaultValue="1" required disabled={empty} aria-label="Aantal afwijkend" className="rounded-lg border bg-background p-2"/>
    <input name="notes" maxLength={1000} disabled={empty} placeholder="Notitie (optioneel)" className="min-w-0 rounded-lg border bg-background p-2"/>
    <button disabled={empty} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40">MELDEN</button>
  </form>
}

export function WorkplaceInventoryMaterials({
  workplaceId,
  workplaceName,
  materials,
  isAdmin,
  isResponsible,
}:{
  workplaceId:string
  workplaceName:string
  materials:WorkplaceInventoryMaterial[]
  isAdmin:boolean
  isResponsible:boolean
}){
  return <section className="space-y-4 rounded-2xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-black">Materialen</h3>
        <p className="text-sm text-muted-foreground">Voorraad gekoppeld aan {workplaceName}. Wijzigingen blijven automatisch aan deze werkplek gekoppeld.</p>
      </div>
      <span className="rounded-full border px-3 py-1 text-xs font-black">{materials.length} ITEM{materials.length===1?'':'S'}</span>
    </div>

    {isAdmin&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Materiaal toevoegen aan deze werkplek</summary>
      <form action={createInventoryItem} className="mt-3 grid gap-2 md:grid-cols-2">
        <input type="hidden" name="workplace_id" value={workplaceId}/>
        <input name="name" required maxLength={200} placeholder="Materiaalnaam" className="rounded-lg border bg-background p-3"/>
        <input name="category" maxLength={120} placeholder="Categorie (optioneel)" className="rounded-lg border bg-background p-3"/>
        <input name="quantity" type="number" min="1" max="100000" defaultValue="1" required className="rounded-lg border bg-background p-3"/>
        <button className="rounded-lg bg-violet-600 p-3 font-bold text-white">TOEVOEGEN</button>
      </form>
    </details>}

    {!materials.length
      ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nog geen materiaal aan deze werkplek gekoppeld.</p>
      : <div className="grid gap-3">{materials.map(item=><article key={item.id} className="space-y-3 rounded-xl border p-4">
          <div>
            <h4 className="font-bold">{item.name}</h4>
            {item.category&&<p className="text-sm text-muted-foreground">{item.category}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <div className="rounded-lg border p-2"><b>{item.available_quantity}</b><p className="text-xs text-muted-foreground">beschikbaar</p></div>
            <div className="rounded-lg border p-2"><b>{item.issued_quantity}</b><p className="text-xs text-muted-foreground">uitgegeven</p></div>
            <div className="rounded-lg border p-2"><b>{item.damaged_quantity}</b><p className="text-xs text-muted-foreground">kapot</p></div>
            <div className="rounded-lg border p-2"><b>{item.missing_quantity}</b><p className="text-xs text-muted-foreground">ontbreekt</p></div>
            <div className="rounded-lg border p-2"><b>{item.total_quantity}</b><p className="text-xs text-muted-foreground">totaal</p></div>
          </div>

          {isAdmin&&<div className="grid gap-2 lg:grid-cols-3">
            <form action={restockInventoryItem} className="grid gap-2 rounded-lg border p-3">
              <input type="hidden" name="item_id" value={item.id}/>
              <b className="text-sm">Voorraad aanvullen</b>
              <input name="quantity" type="number" min="1" max="100000" defaultValue="1" required className="rounded-lg border bg-background p-2"/>
              <input name="notes" maxLength={1000} placeholder="Notitie" className="rounded-lg border bg-background p-2"/>
              <button className="rounded-lg border p-2 font-bold">BIJVULLEN</button>
            </form>
            {item.damaged_quantity>0&&<form action={restoreInventoryQuantity} className="grid gap-2 rounded-lg border p-3">
              <input type="hidden" name="item_id" value={item.id}/>
              <input type="hidden" name="condition" value="damaged"/>
              <b className="text-sm">Kapot herstellen ({item.damaged_quantity})</b>
              <input name="quantity" type="number" min="1" max={item.damaged_quantity} defaultValue="1" required className="rounded-lg border bg-background p-2"/>
              <input name="notes" maxLength={1000} placeholder="Herstelnotitie" className="rounded-lg border bg-background p-2"/>
              <button className="rounded-lg border p-2 font-bold">HERSTELD</button>
            </form>}
            {item.missing_quantity>0&&<form action={restoreInventoryQuantity} className="grid gap-2 rounded-lg border p-3">
              <input type="hidden" name="item_id" value={item.id}/>
              <input type="hidden" name="condition" value="missing"/>
              <b className="text-sm">Ontbrekend teruggevonden ({item.missing_quantity})</b>
              <input name="quantity" type="number" min="1" max={item.missing_quantity} defaultValue="1" required className="rounded-lg border bg-background p-2"/>
              <input name="notes" maxLength={1000} placeholder="Waar teruggevonden?" className="rounded-lg border bg-background p-2"/>
              <button className="rounded-lg border p-2 font-bold">TERUGGEVONDEN</button>
            </form>}
          </div>}
        </article>)}</div>}

    {isResponsible&&materials.length>0&&<div className="grid gap-4 xl:grid-cols-2">
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-black">OPSTARTCONTROLE</summary>
        <p className="mt-2 text-sm text-muted-foreground">Meld alleen materiaal dat bij opstart ontbreekt of kapot is. Als alles klopt hoef je niets te melden.</p>
        <div className="mt-3 space-y-3">{materials.map(item=><div key={'opening:'+item.id}>
          <p className="mb-1 text-sm font-semibold">{item.name} · {item.available_quantity} beschikbaar</p>
          <ConditionForm item={item} phase="opening"/>
        </div>)}</div>
      </details>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-black">SLUITCONTROLE</summary>
        <p className="mt-2 text-sm text-muted-foreground">Meld alleen materiaal dat bij afsluit ontbreekt of kapot is.</p>
        <div className="mt-3 space-y-3">{materials.map(item=><div key={'closing:'+item.id}>
          <p className="mb-1 text-sm font-semibold">{item.name} · {item.available_quantity} beschikbaar</p>
          <ConditionForm item={item} phase="closing"/>
        </div>)}</div>
      </details>
    </div>}
  </section>
}
