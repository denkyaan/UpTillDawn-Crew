'use client'

import {useMemo,useState,useTransition} from 'react'
import {createClient} from '@/lib/supabase/crew-client'

export type SaleProduct={
  id:string
  event_id:string
  workplace_id:string
  name:string
  available_quantity:number
  sale_category:'merch'|'token'
  sale_price_cents:number
}

function euro(cents:number){
  return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(cents/100)
}

export function SalesRegisterClient({initialProducts}:{initialProducts:SaleProduct[]}){
  const [products,setProducts]=useState(initialProducts)
  const [payment,setPayment]=useState<'cash'|'card'>('card')
  const [quantities,setQuantities]=useState<Record<string,number>>({})
  const [message,setMessage]=useState('')
  const [pending,startTransition]=useTransition()

  const grouped=useMemo(()=>({
    merch:products.filter(product=>product.sale_category==='merch'),
    token:products.filter(product=>product.sale_category==='token'),
  }),[products])

  async function sell(product:SaleProduct){
    if(pending)return
    const quantity=Math.max(1,Math.min(product.available_quantity,quantities[product.id]||1))
    setMessage('')
    startTransition(async()=>{
      const s=createClient()
      const {error}=await s.rpc('upt_sales_record',{
        p_item:product.id,
        p_quantity:quantity,
        p_payment_method:payment,
      })
      if(error){
        setMessage(error.message)
        return
      }
      setProducts(current=>current.map(item=>item.id===product.id?{
        ...item,
        available_quantity:item.available_quantity-quantity,
      }:item))
      setQuantities(current=>({...current,[product.id]:1}))
      setMessage(`${quantity} × ${product.name} verkocht · ${payment==='cash'?'cash':'kaart'} · ${euro(product.sale_price_cents*quantity)}`)
    })
  }

  return <section className="space-y-5">
    <div className="sticky top-0 z-10 rounded-2xl border bg-background/95 p-3 backdrop-blur">
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">Betaalmethode voor volgende verkoop</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={()=>setPayment('cash')} className={'rounded-xl border p-3 font-black '+(payment==='cash'?'bg-emerald-700 text-white':'')}>CASH</button>
        <button type="button" onClick={()=>setPayment('card')} className={'rounded-xl border p-3 font-black '+(payment==='card'?'bg-violet-600 text-white':'')}>KAART</button>
      </div>
    </div>

    {message&&<p className="rounded-xl border p-3 text-sm font-semibold">{message}</p>}

    {(['merch','token'] as const).map(kind=><section key={kind} className="space-y-3">
      <h2 className="text-xl font-black">{kind==='merch'?'Merch':'Tokens / Kassa'}</h2>
      {!grouped[kind].length&&<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Geen verkoopartikelen in deze categorie voor jouw werkplek.</p>}
      <div className="grid gap-3 md:grid-cols-2">{grouped[kind].map(product=>{
        const quantity=Math.max(1,quantities[product.id]||1)
        const soldOut=product.available_quantity<=0
        return <article key={product.id} className="space-y-3 rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">{product.name}</h3>
              <p className="text-sm text-muted-foreground">{euro(product.sale_price_cents)} per stuk · {product.available_quantity} op voorraad</p>
            </div>
            <span className={'rounded-full border px-2 py-1 text-xs font-black '+(soldOut?'border-red-500/50 text-red-500':'border-emerald-500/50 text-emerald-600')}>{soldOut?'UITVERKOCHT':'BESCHIKBAAR'}</span>
          </div>

          <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
            <input
              aria-label="Aantal verkopen"
              type="number"
              min="1"
              max={Math.max(1,product.available_quantity)}
              value={quantity}
              disabled={soldOut||pending}
              onChange={event=>setQuantities(current=>({...current,[product.id]:Math.max(1,Number(event.target.value)||1)}))}
              className="rounded-xl border bg-background p-3 text-center font-black"
            />
            <button
              type="button"
              disabled={soldOut||pending||quantity>product.available_quantity}
              onClick={()=>void sell(product)}
              className="rounded-xl bg-emerald-700 p-3 font-black text-white disabled:opacity-40"
            >✓ VERKOCHT · {euro(product.sale_price_cents*quantity)}</button>
          </div>
        </article>
      })}</div>
    </section>)}
  </section>
}
