import {
  createCatalogItem,
  createCatalogWorkplace,
  updateCatalogItem,
  updateCatalogWorkplace,
} from '@/lib/actions/workplace-catalog'

export type CatalogWorkplace={
  id:string
  name:string
  description:string|null
  sort_order:number
  is_active:boolean
  minimum_staff:number
  target_staff:number
  maximum_staff:number|null
}

export type CatalogItem={
  id:string
  catalog_workplace_id:string
  name:string
  category:string|null
  default_quantity:number
  is_active:boolean
}

const field='rounded-lg border bg-background p-2'

export function WorkplaceCatalogInventory({
  workplaces,
  items,
}:{
  workplaces:CatalogWorkplace[]
  items:CatalogItem[]
}){
  return <section className="space-y-4 rounded-3xl border border-violet-500/30 p-4 md:p-5">
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">MASTERINVENTARIS</p>
      <h2 className="text-2xl font-black">Standaardwerkplekken & pre-event inventaris</h2>
      <p className="mt-1 text-sm text-muted-foreground">Deze lijst bestaat altijd, ook zonder evenement. Nieuwe evenementen krijgen deze actieve werkplekken en materialen automatisch mee.</p>
    </div>

    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Nieuwe standaardwerkplek toevoegen</summary>
      <form action={createCatalogWorkplace} className="mt-3 grid gap-2 md:grid-cols-2">
        <input name="name" required maxLength={200} placeholder="Werkpleknaam" className={field}/>
        <input name="description" maxLength={1000} placeholder="Omschrijving (optioneel)" className={field}/>
        <input name="sort_order" type="number" min="0" max="10000" defaultValue="0" aria-label="Volgorde" className={field}/>
        <div className="grid grid-cols-3 gap-2">
          <input name="minimum_staff" type="number" min="0" max="10000" defaultValue="0" aria-label="Minimumbezetting" className={field}/>
          <input name="target_staff" type="number" min="0" max="10000" defaultValue="0" aria-label="Doelbezetting" className={field}/>
          <input name="maximum_staff" type="number" min="0" max="10000" placeholder="Max." aria-label="Maximumbezetting" className={field}/>
        </div>
        <button className="rounded-lg bg-violet-600 px-4 py-3 font-bold text-white md:col-span-2">STANDAARDWERKPLEK TOEVOEGEN</button>
      </form>
    </details>

    {!workplaces.length&&<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nog geen standaardwerkplekken. Voeg ze hier één keer toe; daarna blijven ze permanent beschikbaar voor inventaris en toekomstige evenementen.</p>}

    <div className="grid gap-4 lg:grid-cols-2">{workplaces.map(workplace=>{
      const workplaceItems=items.filter(item=>item.catalog_workplace_id===workplace.id)
      return <article key={workplace.id} className="space-y-3 rounded-2xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="text-xl font-black">{workplace.name}</h3>{workplace.description&&<p className="text-sm text-muted-foreground">{workplace.description}</p>}</div>
          <span className="rounded-full border px-2 py-1 text-xs font-black">{workplace.is_active?'ACTIEF':'INACTIEF'}</span>
        </div>

        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Werkplekinstellingen</summary>
          <form action={updateCatalogWorkplace} className="mt-3 grid gap-2">
            <input type="hidden" name="workplace_id" value={workplace.id}/>
            <input name="name" required defaultValue={workplace.name} maxLength={200} className={field}/>
            <input name="description" defaultValue={workplace.description||''} maxLength={1000} placeholder="Omschrijving (optioneel)" className={field}/>
            <input name="sort_order" type="number" min="0" max="10000" defaultValue={workplace.sort_order} aria-label="Volgorde" className={field}/>
            <div className="grid grid-cols-3 gap-2">
              <input name="minimum_staff" type="number" min="0" max="10000" defaultValue={workplace.minimum_staff} aria-label="Minimumbezetting" className={field}/>
              <input name="target_staff" type="number" min="0" max="10000" defaultValue={workplace.target_staff} aria-label="Doelbezetting" className={field}/>
              <input name="maximum_staff" type="number" min="0" max="10000" defaultValue={workplace.maximum_staff??''} placeholder="Max." aria-label="Maximumbezetting" className={field}/>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={workplace.is_active}/> Actief</label>
            <button className="rounded-lg border px-3 py-2 font-bold">WERKPLEK OPSLAAN</button>
          </form>
        </details>

        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Materiaal toevoegen</summary>
          <form action={createCatalogItem} className="mt-3 grid gap-2">
            <input type="hidden" name="workplace_id" value={workplace.id}/>
            <input name="name" required maxLength={200} placeholder="Materiaalnaam" className={field}/>
            <input name="category" maxLength={120} placeholder="Categorie (optioneel)" className={field}/>
            <input name="quantity" type="number" min="0" max="100000" defaultValue="1" aria-label="Standaardaantal" className={field}/>
            <button className="rounded-lg bg-violet-600 px-3 py-2 font-bold text-white">MATERIAAL TOEVOEGEN</button>
          </form>
        </details>

        {!workplaceItems.length?<p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Nog geen standaardmateriaal voor deze werkplek.</p>:<div className="space-y-2">
          {workplaceItems.map(item=><form key={item.id} action={updateCatalogItem} className="grid gap-2 rounded-xl border p-3">
            <input type="hidden" name="item_id" value={item.id}/>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
              <input name="name" required defaultValue={item.name} maxLength={200} className={field}/>
              <input name="quantity" type="number" min="0" max="100000" defaultValue={item.default_quantity} aria-label="Standaardaantal" className={field}/>
            </div>
            <input name="category" maxLength={120} defaultValue={item.category||''} placeholder="Categorie (optioneel)" className={field}/>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item.is_active}/> Actief in nieuwe evenementen</label>
              <button className="rounded-lg border px-3 py-2 text-sm font-bold">MATERIAAL OPSLAAN</button>
            </div>
          </form>)}
        </div>}
      </article>
    })}</div>
  </section>
}
