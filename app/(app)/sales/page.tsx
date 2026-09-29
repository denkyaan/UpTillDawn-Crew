import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {PlatformAiAssistant} from '@/components/admin/platform-ai-assistant'

export const dynamic='force-dynamic'

const money=(cents:number)=>new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(cents/100)

type EventRow={id:string;name:string;status:string;start_at:string}
type Transaction={
  id:string
  event_id:string
  workplace_id:string
  transaction_type:string
  product_name:string
  sale_category:string
  quantity:number
  total_cents:number
  payment_method:string
  created_at:string
}

export default async function SalesPage({
  searchParams,
}:{
  searchParams:Promise<{event?:string;workplace?:string}>
}){
  const current=await getCurrentUser()
  if(!current)redirect('/login')

  const s=await createClient()
  const params=await searchParams
  const isAdmin=current.isAdmin===true

  let events:EventRow[]=[]
  let eventLoadError=false

  if(isAdmin){
    const {data,error}=await s
      .from('events')
      .select('id,name,status,start_at')
      .neq('status','archived')
      .order('start_at',{ascending:false})
    eventLoadError=Boolean(error)
    events=(data||[]) as EventRow[]
  }else{
    const [{data:members},{data:shifts}]=await Promise.all([
      s.from('event_members').select('event_id').eq('user_id',current.id),
      s.from('shifts').select('event_id').eq('user_id',current.id).neq('status','cancelled'),
    ])
    const ids=[...new Set([
      ...(members||[]).map(row=>row.event_id),
      ...(shifts||[]).map(row=>row.event_id),
    ])]
    if(ids.length){
      const {data,error}=await s
        .from('events')
        .select('id,name,status,start_at')
        .in('id',ids)
        .neq('status','archived')
        .order('start_at',{ascending:false})
      eventLoadError=Boolean(error)
      events=(data||[]) as EventRow[]
    }
  }

  const selected=events.find(event=>event.id===params.event)||events[0]||null

  let transactions:Transaction[]=[]
  let transactionLoadError=false
  let workplaceNames=new Map<string,string>()

  if(selected){
    const [transactionResult,workplaceResult]=await Promise.all([
      s.from('sales_transactions')
        .select('id,event_id,workplace_id,transaction_type,product_name,sale_category,quantity,total_cents,payment_method,created_at')
        .eq('event_id',selected.id)
        .order('created_at',{ascending:false})
        .limit(1000),
      s.from('workplaces')
        .select('id,name')
        .eq('event_id',selected.id)
        .eq('is_active',true),
    ])
    transactionLoadError=Boolean(transactionResult.error)
    transactions=(transactionResult.data||[]) as Transaction[]
    if(params.workplace)transactions=transactions.filter(transaction=>transaction.workplace_id===params.workplace)
    workplaceNames=new Map((workplaceResult.data||[]).map(row=>[row.id,row.name]))
  }

  const sign=(tx:Transaction)=>tx.transaction_type==='refund'?-1:1
  const amount=(rows:Transaction[])=>rows.reduce((sum,tx)=>sum+sign(tx)*Number(tx.total_cents),0)
  const eventRevenue=amount(transactions)
  const merchRevenue=amount(transactions.filter(tx=>tx.sale_category==='merch'))
  const tokenRevenue=amount(transactions.filter(tx=>tx.sale_category==='token'))
  const cashRevenue=amount(transactions.filter(tx=>tx.payment_method==='cash'))
  const cardRevenue=amount(transactions.filter(tx=>tx.payment_method==='card'))

  return <main className="mx-auto max-w-7xl space-y-6 p-4 pb-28 md:p-8">
    <header className="space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">INKOMSTEN</p>
        <h1 className="text-3xl font-black">Sales</h1>
        <p className="mt-1 text-sm text-muted-foreground">Alleen inkomsten per evenement: merch en kassa/tokens. Vanuit een werkplekklik wordt het overzicht automatisch op die werkplek gefilterd.</p>
      </div>

      {eventLoadError&&<p className="rounded-xl border border-amber-500/40 p-3 text-sm text-amber-600">Evenementen konden tijdelijk niet volledig worden geladen.</p>}

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <select name="event" defaultValue={selected?.id||''} className="min-w-0 flex-1 rounded-xl border bg-background p-3">
          <option value="" disabled>Evenement…</option>
          {events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        {params.workplace&&<input type="hidden" name="workplace" value={params.workplace}/>}<button className="rounded-xl border px-4 py-3 font-bold">EVENEMENT OPENEN</button>
      </form>
    </header>

    {isAdmin&&selected&&<PlatformAiAssistant eventId={selected.id} contextKey="sales" contextLabel={'Sales · '+selected.name}/>}

    {!selected
      ? <p className="rounded-2xl border p-5 text-muted-foreground">Geen evenement beschikbaar.</p>
      : <>
        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border p-5">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Evenement</p>
            <h2 className="mt-2 text-2xl font-black">{selected.name}</h2>{params.workplace&&<p className="mt-1 text-sm font-semibold text-violet-400">Werkplek: {workplaceNames.get(params.workplace)||'geselecteerd'}</p>}
            <p className="mt-3 text-3xl font-black">{money(eventRevenue)}</p>
            <p className="text-sm text-muted-foreground">Totale netto-inkomsten</p>
          </article>

          <article className="rounded-2xl border p-5">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Merch</p>
            <p className="mt-3 text-3xl font-black">{money(merchRevenue)}</p>
            <p className="text-sm text-muted-foreground">Merchandise-inkomsten</p>
          </article>

          <article className="rounded-2xl border p-5">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Kassa / Tokens</p>
            <p className="mt-3 text-3xl font-black">{money(tokenRevenue)}</p>
            <p className="text-sm text-muted-foreground">Token- en kassaverkoop</p>
          </article>
        </section>

        <section className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Inkomstenoverzicht</h2>
              <p className="text-sm text-muted-foreground">Cash {money(cashRevenue)} · kaart {money(cardRevenue)}</p>
            </div>
            <span className="rounded-full border px-3 py-2 text-sm font-bold">{transactions.length} transacties</span>
          </div>

          {transactionLoadError&&<p className="mt-3 rounded-xl border border-amber-500/40 p-3 text-sm text-amber-600">Transacties konden tijdelijk niet volledig worden geladen.</p>}

          {!transactions.length
            ? <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nog geen inkomsten geregistreerd voor dit evenement.</p>
            : <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="p-2">Tijd</th>
                      <th className="p-2">Categorie</th>
                      <th className="p-2">Omschrijving</th>
                      <th className="p-2">Werkplek</th>
                      <th className="p-2">Betaling</th>
                      <th className="p-2 text-right">Bedrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx=><tr key={tx.id} className="border-b last:border-0">
                      <td className="p-2">{new Date(tx.created_at).toLocaleString('nl-BE')}</td>
                      <td className="p-2">{tx.sale_category==='merch'?'Merch':'Kassa / Tokens'}</td>
                      <td className="p-2">{tx.product_name} × {tx.quantity}</td>
                      <td className="p-2">{workplaceNames.get(tx.workplace_id)||'Werkplek'}</td>
                      <td className="p-2">{tx.payment_method==='cash'?'Cash':tx.payment_method==='card'?'Kaart':tx.payment_method}</td>
                      <td className="p-2 text-right font-bold">{tx.transaction_type==='refund'?'-':''}{money(Math.abs(Number(tx.total_cents)))}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
        </section>
      </>}
  </main>
}
