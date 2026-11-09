"use client"
import {useEffect,useMemo,useState} from 'react'
import {parseEuroFee,previewProviderSettlement,type SettlementTransaction} from '@/lib/administration/provider-bank-settlement'
import type {SupportedUiLocale} from '@/lib/locale-preferences'
type Bank={id:string;booked_on:string;transaction_id:string;amount_cents:number;payment_reference:string}
type Settlement={id:string;provider:string;event_id:string;payout_cents:number|string;approved_at:string}
type Data={bankStatements:Bank[];transactions:SettlementTransaction[];settlements:Settlement[];canApprove:boolean}
const copy={
 nl:{title:'Provideruitbetalingen koppelen aan bank',intro:'Controleer geïmporteerde Eventix- of SumUp-transacties tegen een echte bankbijschrijving. Voer ingehouden kosten afzonderlijk in. Deze koppeling boekt geen omzet of factuurbetaling en voert geen overschrijving uit.',load:'Vernieuwen',loading:'Bank- en providerregels laden…',error:'Register onvolledig of niet beschikbaar.',bank:'Bankbijschrijving',group:'Provider en evenement',rows:'Transacties kiezen',all:'Alle getoonde kiezen',fee:'Ingehouden kosten (EUR)',note:'Controleverklaring (minimaal 10 tekens)',net:'Provider netto vóór kosten',payout:'Verwachte uitbetaling',actual:'Bankbedrag',mismatch:'Bedragen komen niet overeen.',approve:'Definitief koppelen (Admin)',busy:'Opslaan…',confirm:'Heb je deze uitbetaling, providerregels en kosten onafhankelijk gecontroleerd? Deze koppeling is definitief.',saved:'Uitbetaling geregistreerd zonder dubbel boeken.',failed:'Koppeling geweigerd. Controleer bedragen en reeds gekoppelde regels.',admin:'Alleen Admin kan definitief koppelen.',empty:'Geen beschikbare bank- of providerregels.',history:'Koppelingshistoriek',none:'Geen koppelingen.',limit:'Maximaal 500 transacties per koppeling.'},
 fr:{title:'Rapprocher les virements fournisseurs',intro:'Comparez les transactions Eventix ou SumUp importées avec un crédit bancaire réel, frais inclus. Aucun chiffre d’affaires ni paiement de facture n’est créé et aucun virement n’est exécuté.',load:'Actualiser',loading:'Chargement des données…',error:'Registre incomplet ou indisponible.',bank:'Crédit bancaire',group:'Fournisseur et événement',rows:'Sélectionner les transactions',all:'Tout sélectionner',fee:'Frais retenus (EUR)',note:'Justification (10 caractères minimum)',net:'Net fournisseur avant frais',payout:'Virement attendu',actual:'Crédit bancaire',mismatch:'Montants différents.',approve:'Rapprochement définitif (Admin)',busy:'Enregistrement…',confirm:'Avez-vous contrôlé le virement, les transactions et les frais ? Ce rapprochement est définitif.',saved:'Rapprochement enregistré sans double comptabilisation.',failed:'Rapprochement refusé. Vérifiez montants et doublons.',admin:'Seul Admin peut confirmer.',empty:'Aucune transaction ou crédit disponible.',history:'Historique',none:'Aucun rapprochement.',limit:'500 transactions au maximum par rapprochement.'},
 en:{title:'Match provider payouts to bank credits',intro:'Independently check imported Eventix or SumUp transactions against a real bank credit, including provider fees. This match posts no sales or invoice payments and initiates no transfer.',load:'Refresh data',loading:'Loading bank and provider records…',error:'Register incomplete or unavailable.',bank:'Bank credit',group:'Provider and event',rows:'Select transactions',all:'Select all shown',fee:'Withheld fees (EUR)',note:'Review attestation (at least 10 characters)',net:'Provider net before fees',payout:'Expected payout',actual:'Bank credit',mismatch:'Amounts do not balance.',approve:'Approve final match (Admin)',busy:'Recording…',confirm:'Have you independently verified the bank credit, provider transactions and fees? This match is permanent.',saved:'Settlement recorded without duplicate posting.',failed:'Match rejected. Check amounts and already matched rows.',admin:'Only Admin can approve matches.',empty:'No eligible bank or provider records.',history:'Match history',none:'No matches yet.',limit:'Up to 500 transactions per match.'},
 de:{title:'Anbieterauszahlungen mit Bankgutschriften abgleichen',intro:'Importierte Eventix- oder SumUp-Transaktionen mit einer echten Bankgutschrift und Gebühren prüfen. Keine Umsatz- oder Rechnungsbuchung und keine Überweisung.',load:'Aktualisieren',loading:'Bank- und Anbieterdaten laden…',error:'Register unvollständig oder nicht verfügbar.',bank:'Bankgutschrift',group:'Anbieter und Veranstaltung',rows:'Transaktionen wählen',all:'Alle sichtbaren wählen',fee:'Einbehaltene Gebühren (EUR)',note:'Prüfvermerk (mindestens 10 Zeichen)',net:'Anbieter-Netto vor Gebühren',payout:'Erwartete Auszahlung',actual:'Bankbetrag',mismatch:'Beträge stimmen nicht überein.',approve:'Endgültig abgleichen (Admin)',busy:'Speichern…',confirm:'Sind Bankgutschrift, Anbietertransaktionen und Gebühren geprüft? Dieser Abgleich bleibt unveränderlich.',saved:'Auszahlung ohne Doppelbuchung abgeglichen.',failed:'Abgleich abgelehnt. Beträge und vorhandene Zuordnungen prüfen.',admin:'Nur Admin kann endgültig freigeben.',empty:'Keine verfügbaren Bank- oder Anbietertransaktionen.',history:'Abgleichhistorie',none:'Noch keine Zuordnungen.',limit:'Maximal 500 Transaktionen pro Abgleich.'}
} as const
const intl={nl:'nl-BE',fr:'fr-BE',en:'en-GB',de:'de-DE'} as const
export default function ProviderBankSettlementWorkspace({locale}:{locale:SupportedUiLocale}){
 const t=copy[locale]
 const [data,setData]=useState<Data|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [busy,setBusy]=useState(false)
 const [bankId,setBankId]=useState('')
 const [group,setGroup]=useState('')
 const [selectedIds,setSelectedIds]=useState<string[]>([])
 const [fee,setFee]=useState('0')
 const [note,setNote]=useState('')
 const [feedback,setFeedback]=useState('')
 async function refresh(signal?:AbortSignal){
  setLoading(true);setError(false)
  try{
   const response=await fetch('/api/administration/provider-settlements',{cache:'no-store',signal})
   if(!response.ok)throw Error('Unavailable')
   const next:Data=await response.json()
   if(!Array.isArray(next.bankStatements)||!Array.isArray(next.transactions)||!Array.isArray(next.settlements)||typeof next.canApprove!=='boolean')throw Error('Invalid response')
   if(!signal?.aborted){setData(next);setSelectedIds([]);setBankId('');setGroup('')}
  }catch{if(!signal?.aborted){setData(null);setError(true)}}
  finally{if(!signal?.aborted)setLoading(false)}
 }
 useEffect(()=>{const abort=new AbortController();void refresh(abort.signal);return()=>abort.abort()},[])
 const groups=useMemo(()=>[...new Set((data?.transactions??[]).map(row=>row.provider+'|'+row.event_id))].sort(),[data])
 const available=useMemo(()=>data?.transactions.filter(row=>row.provider+'|'+row.event_id===group).slice(0,500)??[],[data,group])
 const selected=useMemo(()=>available.filter(row=>selectedIds.includes(row.id)),[available,selectedIds])
 const feeCents=parseEuroFee(fee)
 const preview=feeCents===null?null:previewProviderSettlement(selected,feeCents)
 const bank=data?.bankStatements.find(row=>row.id===bankId)
 const valid=!!preview&&!!bank&&preview.payoutCents===bank.amount_cents&&note.trim().length>=10&&note.trim().length<=500
 const money=(cents:number)=>new Intl.NumberFormat(intl[locale],{style:'currency',currency:'EUR'}).format(cents/100)
 async function save(){
  if(!data?.canApprove||!valid||!preview||!bank||busy||!window.confirm(t.confirm))return
  setBusy(true);setFeedback('')
  try{
   const response=await fetch('/api/administration/provider-settlements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({statementId:bank.id,transactionIds:selectedIds,feeCents,note:note.trim()})})
   if(!response.ok)throw Error('Rejected')
   setNote('');setFee('0');setFeedback(t.saved)
   await refresh()
  }catch{setFeedback(t.failed)}finally{setBusy(false)}
 }
 return <section className="space-y-4 rounded-2xl border bg-card p-5" aria-label={t.title}>
  <h2 className="text-lg font-semibold">{t.title}</h2><p className="text-sm text-muted-foreground">{t.intro}</p>
  <button type="button" className="rounded border px-3 py-2 text-sm" disabled={loading||busy} onClick={()=>void refresh()}>{t.load}</button>
  {loading&&<p role="status">{t.loading}</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{t.error}</p>}
  {feedback&&<p role="status" className="text-sm">{feedback}</p>}
  {data&&!error&&<>
   {!data.canApprove&&<p className="text-sm text-muted-foreground">{t.admin}</p>}
   {(!data.bankStatements.length||!groups.length)&&<p className="text-sm text-muted-foreground">{t.empty}</p>}
   {!!data.bankStatements.length&&!!groups.length&&<div className="space-y-3 rounded-xl border p-4">
    <label className="grid gap-1 text-sm">{t.bank}
     <select value={bankId} onChange={event=>setBankId(event.target.value)} className="rounded-lg border bg-background p-3">
      <option value="">—</option>{data.bankStatements.map(row=><option key={row.id} value={row.id}>{row.booked_on} · {row.transaction_id} · {money(row.amount_cents)}</option>)}
     </select>
    </label>
    <label className="grid gap-1 text-sm">{t.group}
     <select value={group} onChange={event=>{setGroup(event.target.value);setSelectedIds([])}} className="rounded-lg border bg-background p-3">
      <option value="">—</option>{groups.map(value=><option key={value} value={value}>{value.replace('|',' · ')}</option>)}
     </select>
    </label>
    {group&&<div className="space-y-2">
     <p className="text-sm font-semibold">{t.rows}: {selectedIds.length} / {available.length}</p>
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={available.length>0&&selectedIds.length===available.length} onChange={event=>setSelectedIds(event.target.checked?available.map(row=>row.id):[])} />{t.all}</label>
     <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
      {available.map(row=><label key={row.id} className="flex items-center gap-3 rounded p-2 text-sm hover:bg-muted/50"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={event=>setSelectedIds(ids=>event.target.checked?[...ids,row.id]:ids.filter(id=>id!==row.id))}/><span className="min-w-0 flex-1 break-all">{row.transaction_id} ({row.status})</span><span className="tabular-nums">{money(row.status==='refunded'?-row.amount_cents:row.amount_cents)}</span></label>)}
     </div><p className="text-xs text-muted-foreground">{t.limit}</p>
    </div>}
    <label className="grid gap-1 text-sm">{t.fee}<input inputMode="decimal" value={fee} onChange={event=>setFee(event.target.value)} className="rounded-lg border bg-background p-3"/></label>
    <label className="grid gap-1 text-sm">{t.note}<textarea minLength={10} maxLength={500} value={note} onChange={event=>setNote(event.target.value)} className="min-h-20 rounded-lg border bg-background p-3"/></label>
    {preview&&<div className="space-y-1 rounded-lg border p-3 text-sm"><p>{t.net}: {money(preview.providerNetCents)}</p><p>{t.fee}: {money(preview.feeCents)}</p><p>{t.payout}: <strong>{money(preview.payoutCents)}</strong></p>{bank&&<p>{t.actual}: <strong>{money(bank.amount_cents)}</strong></p>}</div>}
    {preview&&bank&&preview.payoutCents!==bank.amount_cents&&<p role="alert" className="text-sm text-amber-600">{t.mismatch}</p>}
    <button type="button" disabled={!data.canApprove||!valid||busy} onClick={()=>void save()} className="rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?t.busy:t.approve}</button>
   </div>}
   <details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">{t.history}: {data.settlements.length}</summary>
    {!data.settlements.length?<p className="mt-2 text-sm">{t.none}</p>:<ul className="mt-2 space-y-2">{data.settlements.map(item=><li key={item.id} className="rounded-lg border p-2 text-sm">{item.provider} · {item.event_id} · {money(Number(item.payout_cents))} · {item.approved_at.slice(0,10)}</li>)}</ul>}
   </details>
  </>}
 </section>
}
