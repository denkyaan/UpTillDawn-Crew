'use client'

import {useActionState} from 'react'
import {receiveAdminInventoryBatch,type BulkReceiptState} from '@/lib/actions/admin-inventory-batch'
import type {SupportedUiLocale} from '@/lib/locale-preferences'
import type {InventoryReceiptProposal} from '@/lib/administration/inventory-receipt-matching'

const copy={
 nl:{review:'Controleer elke materiaalnaam en hoeveelheid vóór de voorraadboeking.',confirm:'Ik heb de voorstellen gecontroleerd en keur deze ontvangst goed.',submit:'Alle voorgestelde materialen ontvangen',loading:'Voorraad boeken…',done:'Ontvangen regels',invalid:'Ongeldige aanvraag of bevestiging ontbreekt.',rejected:'Ontvangst geweigerd. Controleer resterende aantallen en factuurstatus; de transactie is teruggedraaid.',denied:'Alleen Admin kan ontvangsten boeken.'},
 fr:{review:'Vérifiez chaque article et quantité avant de mettre le stock à jour.',confirm:'J’ai vérifié les lignes et j’approuve cette réception.',submit:'Réceptionner tous les articles proposés',loading:'Enregistrement…',done:'Lignes reçues',invalid:'Demande invalide ou confirmation manquante.',rejected:'Réception refusée. Vérifiez les quantités et la facture; la transaction a été annulée.',denied:'Seul Admin peut enregistrer les réceptions.'},
 en:{review:'Check each item and quantity before changing inventory.',confirm:'I checked the suggestions and approve this receipt.',submit:'Receive all suggested items',loading:'Saving stock…',done:'Received lines',invalid:'Invalid request or missing confirmation.',rejected:'Receipt rejected. Check the remaining quantities and invoice approval; the transaction was rolled back.',denied:'Only Admin can post inventory receipts.'},
 de:{review:'Alle Artikel und Mengen vor der Lagerbuchung prüfen.',confirm:'Ich habe die Vorschläge geprüft und genehmige den Wareneingang.',submit:'Alle vorgeschlagenen Artikel übernehmen',loading:'Bestand buchen…',done:'Erhaltene Positionen',invalid:'Ungültige Anfrage oder Bestätigung fehlt.',rejected:'Wareneingang abgelehnt. Mengen und Rechnung prüfen; die Transaktion wurde zurückgesetzt.',denied:'Nur Admin darf Wareneingänge buchen.'},
} as const

export function InventoryBulkReceiptForm({
 request,document,proposals,locale,
}:{request:string;document:string;proposals:readonly InventoryReceiptProposal[];locale:SupportedUiLocale}){
 const [state,action,pending]=useActionState<BulkReceiptState,FormData>(
  receiveAdminInventoryBatch,{ok:false,count:0,error:null})
 const t=copy[locale]
 return <form action={action} className="space-y-3">
  <input type="hidden" name="request" value={request}/>
  <input type="hidden" name="document" value={document}/>
  <input type="hidden" name="rows" value={JSON.stringify(proposals.map(row=>({
   line:row.line,item:row.item,quantity:row.quantity,
  })))}/>
  <p className="text-xs text-muted-foreground">{t.review}</p>
  <ul className="divide-y text-sm">{proposals.map(row=><li key={row.line}
   className="flex flex-wrap justify-between gap-2 py-2">
   <span>{row.description} → {row.itemName}</span>
   <b>{row.quantity}</b>
  </li>)}</ul>
  <label className="flex items-start gap-2 text-sm">
   <input type="checkbox" name="confirm" value="yes" required className="mt-1"/>
   <span>{t.confirm}</span>
  </label>
  <button type="submit" disabled={pending}
   className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
   {pending?t.loading:t.submit}
  </button>
  {state.ok&&<p role="status" aria-live="polite" className="text-sm text-emerald-500">
   {t.done}: {state.count}
  </p>}
  {state.code&&<p role="alert" aria-live="assertive" className="text-sm text-amber-500">
   {t[state.code as 'invalid'|'rejected'|'denied']??t.rejected}
  </p>}
 </form>
}
