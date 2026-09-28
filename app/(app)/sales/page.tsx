import Link from 'next/link'
import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {configureSaleItem,refundSale,setOpeningCash} from '@/lib/actions/sales'
import {SalesRegisterClient,type SaleProduct} from '@/components/crew/sales-register-client'

export const dynamic='force-dynamic'

const money=(cents:number)=>new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(cents/100)

export default async function SalesPage({
  searchParams,
}:{
  searchParams:Promise<{event?:string}>
}){
  const current=await getCurrentUser()
  if(!current)redirect('/login')
  const s=await createClient()
  const params=await searchParams
  const isAdmin=current.isAdmin===true

  const {data:visibleProducts,error:productError}=await s
    .from('inventory_items')
    .select('id,event_id,workplace_id,name,available_quantity,sale_category,sale_price_cents')
    .eq('is_active',true)
    .eq('sale_enabled',true)
    .order('name')
  if(productError)throw new Error('Verkoopartikelen konden niet worden geladen.')

  const productEventIds=[...new Set((visibleProducts||[]).map(item=>item.event_id))]
  let events:Array<{id:string;name:string;status:string;start_at:string}>=[]
  if(isAdmin){
    const {data,error}=await s.from('events').select('id,name,status,start_at').neq('status','archived').order('start_at',{ascending:false})
    if(error)throw new Error('Evenementen konden niet worden geladen.')
    events=data||[]
  }else if(productEventIds.length){
    const {data,error}=await s.from('events').select('id,name,status,start_at').in('id',productEventIds).neq('status','archived').order('start_at',{ascending:false})
    if(error)throw new Error('Evenementen konden niet worden geladen.')
    events=data||[]
  }

  const selected=events.find(event=>event.id===params.event)
    ||events.find(event=>productEventIds.includes(event.id))
    ||events[0]
    ||null

  const products=((visibleProducts||[]).filter(item=>!selected||item.event_id===selected.id).filter(item=>
    (item.sale_category==='merch'||item.sale_category==='token')&&typeof item.sale_price_cents==='number'
  )) as SaleProduct[]

  let allInventory:Array<{
    id:string;event_id:string;workplace_id:string;name:string;available_quantity:number;
    sale_enabled:boolean;sale_category:string|null;sale_price_cents:number|null
  }>=[]
  let workplaces:Array<{id:string;event_id:string;name:string}>=[]
  let transactions:Array<{
    id:string;event_id:string;workplace_id:string;inventory_item_id:string;seller_id:string|null;
    transaction_type:string;original_sale_id:string|null;product_name:string;sale_category:string;
    quantity:number;unit_price_cents:number;total_cents:number;payment_method:string;notes:string|null;created_at:string
  }>=[]
  let registers:Array<{event_id:string;workplace_id:string;opening_cash_cents:number;opened_at:string}>=[]
  let people:Array<{id:string;full_name:string|null}>=[]

  if(isAdmin&&selected){
    const [inventoryResult,workplaceResult,transactionResult,registerResult,peopleResult]=await Promise.all([
      s.from('inventory_items').select('id,event_id,workplace_id,name,available_quantity,sale_enabled,sale_category,sale_price_cents').eq('event_id',selected.id).eq('is_active',true).order('name'),
      s.from('workplaces').select('id,event_id,name').eq('event_id',selected.id).eq('is_active',true).order('name'),
      s.from('sales_transactions').select('id,event_id,workplace_id,inventory_item_id,seller_id,transaction_type,original_sale_id,product_name,sale_category,quantity,unit_price_cents,total_cents,payment_method,notes,created_at').eq('event_id',selected.id).order('created_at',{ascending:false}).limit(1000),
      s.from('sales_registers').select('event_id,workplace_id,opening_cash_cents,opened_at').eq('event_id',selected.id),
      s.rpc('upt_admin_personnel_details_v2'),
    ])
    if(inventoryResult.error||workplaceResult.error||transactionResult.error||registerResult.error){
      throw new Error('Salesbeheer kon niet volledig worden geladen.')
    }
    allInventory=inventoryResult.data||[]
    workplaces=workplaceResult.data||[]
    transactions=(transactionResult.data||[]) as typeof transactions
    registers=registerResult.data||[]
    people=peopleResult.data||[]
  }

  const sign=(transaction:{transaction_type:string})=>transaction.transaction_type==='refund'?-1:1
  const netRevenue=transactions.reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
  const cashRevenue=transactions.filter(tx=>tx.payment_method==='cash').reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
  const cardRevenue=transactions.filter(tx=>tx.payment_method==='card').reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
  const merchRevenue=transactions.filter(tx=>tx.sale_category==='merch').reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
  const tokenRevenue=transactions.filter(tx=>tx.sale_category==='token').reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
  const workplaceName=new Map(workplaces.map(row=>[row.id,row.name]))
  const personName=new Map(people.map(row=>[row.id,row.full_name||'Personeelslid']))

  return <main className="mx-auto max-w-7xl space-y-6 p-4 pb-28 md:p-8">
    <header className="space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">{isAdmin?'SALES':'VERKOOP'}</p>
        <h1 className="text-3xl font-black">{isAdmin?'Sales':'Merch & Tokens / Kassa'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Elke verkoop verlaagt onmiddellijk dezelfde inventarisvoorraad. Cash en kaart worden apart geregistreerd.</p>
      </div>
      {events.length>0&&<form method="get" className="flex flex-col gap-2 sm:flex-row">
        <select name="event" defaultValue={selected?.id||''} className="min-w-0 flex-1 rounded-xl border bg-background p-3">
          {events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <button className="rounded-xl border px-4 py-3 font-bold">EVENEMENT OPENEN</button>
      </form>}
    </header>

    {!selected
      ? <p className="rounded-2xl border p-4 text-muted-foreground">Geen evenement met verkoop beschikbaar.</p>
      : <SalesRegisterClient key={selected.id} initialProducts={products}/>}

    {isAdmin&&selected&&<section className="space-y-5 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-black">Salesbeheer · {selected.name}</h2><p className="text-sm text-muted-foreground">Prijzen, startcash, omzet en transacties.</p></div>
        <Link href={'/api/uptilldawn/sales-export?event='+encodeURIComponent(selected.id)} className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">EXCEL SALES DOWNLOADEN</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Netto omzet</p><p className="text-2xl font-black">{money(netRevenue)}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Cash</p><p className="text-2xl font-black">{money(cashRevenue)}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Kaart</p><p className="text-2xl font-black">{money(cardRevenue)}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Merch</p><p className="text-2xl font-black">{money(merchRevenue)}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Tokens</p><p className="text-2xl font-black">{money(tokenRevenue)}</p></div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-2xl border p-4">
          <h3 className="text-xl font-black">Verkoopartikelen & prijzen</h3>
          {!allInventory.length&&<p className="text-sm text-muted-foreground">Geen inventarisitems voor dit evenement.</p>}
          {allInventory.map(item=><form key={item.id} action={configureSaleItem} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_130px_120px_auto]">
            <input type="hidden" name="item_id" value={item.id}/>
            <div><b>{item.name}</b><p className="text-xs text-muted-foreground">{item.available_quantity} voorraad · {workplaceName.get(item.workplace_id)||'Werkplek'}</p></div>
            <select name="sale_category" defaultValue={item.sale_category||'merch'} className="rounded-lg border bg-background p-2">
              <option value="merch">Merch</option>
              <option value="token">Token</option>
            </select>
            <input name="price" type="number" min="0" max="100000" step="0.01" defaultValue={item.sale_price_cents==null?'':item.sale_price_cents/100} placeholder="Prijs €" className="rounded-lg border bg-background p-2"/>
            <label className="flex items-center gap-2 rounded-lg border px-3"><input type="checkbox" name="enabled" defaultChecked={item.sale_enabled}/> Verkoop</label>
            <button className="rounded-lg border px-3 py-2 font-bold sm:col-span-4">VERKOOPINSTELLING OPSLAAN</button>
          </form>)}
        </article>

        <article className="space-y-3 rounded-2xl border p-4">
          <h3 className="text-xl font-black">Kassa begininhoud</h3>
          <p className="text-sm text-muted-foreground">Admin registreert hoeveel cash er bij opstart in elke kassa/werkplek zit. Verwachte cash = begininhoud + netto cashverkopen.</p>
          <form action={setOpeningCash} className="grid gap-2">
            <input type="hidden" name="event_id" value={selected.id}/>
            <select name="workplace_id" required className="rounded-lg border bg-background p-3">
              <option value="">Kassa / werkplek kiezen…</option>
              {workplaces.map(workplace=><option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}
            </select>
            <input name="opening_cash" type="number" min="0" max="1000000" step="0.01" required placeholder="Begininhoud cash €" className="rounded-lg border bg-background p-3"/>
            <button className="rounded-xl border p-3 font-bold">BEGININHOUD OPSLAAN</button>
          </form>
          <div className="space-y-2">{registers.map(register=>{
            const netCash=transactions.filter(tx=>tx.workplace_id===register.workplace_id&&tx.payment_method==='cash').reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
            return <div key={register.workplace_id} className="rounded-xl border p-3">
              <b>{workplaceName.get(register.workplace_id)||'Kassa'}</b>
              <p className="text-sm text-muted-foreground">Start {money(register.opening_cash_cents)} · cashverkopen {money(netCash)}</p>
              <p className="mt-1 font-black">Verwacht in kassa: {money(register.opening_cash_cents+netCash)}</p>
            </div>
          })}</div>
        </article>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h3 className="text-xl font-black">Transacties</h3>
        {!transactions.length&&<p className="text-sm text-muted-foreground">Nog geen verkopen geregistreerd.</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">Tijd</th><th className="p-2">Item</th><th className="p-2">Categorie</th><th className="p-2">Aantal</th><th className="p-2">Betaling</th><th className="p-2">Bedrag</th><th className="p-2">Medewerker</th><th className="p-2">Actie</th></tr></thead>
          <tbody>{transactions.map(tx=><tr key={tx.id} className="border-b">
            <td className="p-2">{new Date(tx.created_at).toLocaleString('nl-BE')}</td>
            <td className="p-2 font-semibold">{tx.product_name}{tx.transaction_type==='refund'?' · REFUND':''}</td>
            <td className="p-2">{tx.sale_category==='merch'?'Merch':'Token'}</td>
            <td className="p-2">{tx.quantity}</td>
            <td className="p-2">{tx.payment_method==='cash'?'Cash':'Kaart'}</td>
            <td className="p-2">{tx.transaction_type==='refund'?'-':''}{money(Number(tx.total_cents))}</td>
            <td className="p-2">{tx.seller_id?personName.get(tx.seller_id)||'Personeelslid':'—'}</td>
            <td className="p-2">{tx.transaction_type==='sale'&&<details>
              <summary className="cursor-pointer text-xs font-bold">TERUGBOEKEN</summary>
              <form action={refundSale} className="mt-2 grid gap-1">
                <input type="hidden" name="sale_id" value={tx.id}/>
                <input name="quantity" type="number" min="1" max={tx.quantity} defaultValue="1" className="rounded border bg-background p-1"/>
                <input name="notes" maxLength={1000} placeholder="Reden" className="rounded border bg-background p-1"/>
                <button className="rounded border border-red-500/50 p-1 text-red-500">BEVESTIG REFUND</button>
              </form>
            </details>}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </section>}
  </main>
}
