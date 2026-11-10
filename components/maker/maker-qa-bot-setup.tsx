'use client'

import {useActionState} from 'react'
import {provisionOwnerQaBots,type QaBotProvisionState} from '@/lib/actions/maker-qa-bots'

const initial:QaBotProvisionState={status:'idle',message:'',accounts:[]}
function csvCell(value:string){return '"'+value.replaceAll('"','""')+'"'}
function downloadCredentials(accounts:QaBotProvisionState['accounts']){
 const rows=[['Rol','Login','Wachtwoord'],...accounts.map(account=>[account.role,account.email,account.password])]
 const csv='\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'
 const file=new Blob([csv],{type:'text/csv;charset=utf-8'})
 const url=URL.createObjectURL(file)
 const link=document.createElement('a')
 link.href=url
 link.download='UpTillDawn-7-testbots-login.csv'
 document.body.append(link)
 link.click()
 link.remove()
 // Safari on iOS may begin the download after the click handler returns.
 window.setTimeout(()=>URL.revokeObjectURL(url),5000)
}
export function MakerQaBotSetup(){
 const [state,action,pending]=useActionState(provisionOwnerQaBots,initial)
 return <section className="mt-7 rounded-2xl border border-white/10 bg-black/40 p-4">
  <h2 className="font-bold text-white">Zeven QA-rolbots</h2>
  <p className="mt-1 text-sm text-zinc-400">Alleen op de main-testomgeving: Hoofdadmin, Linkerhand, Rechterhand, Verantwoordelijke, Personeel, Promotie en Administratie. Je Maker-account wordt niet aangepast.</p>
  <form action={action} className="mt-3">
   <button type="submit" disabled={pending} className="w-full rounded-xl border border-violet-500/50 bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
    {pending?'Testbots instellen…':'Zeven rolbots instellen en beveiligen'}
   </button>
  </form>
  {state.message&&<p role={state.status==='error'?'alert':'status'} className={'mt-3 text-sm '+(state.status==='error'?'text-red-300':'text-green-300')}>{state.message}</p>}
  {state.status==='ok'&&state.accounts.length===7&&<>
   <button type="button" onClick={()=>downloadCredentials(state.accounts)} className="mt-3 w-full rounded-xl border border-green-600/60 px-4 py-3 text-sm font-bold text-green-300">
    Download de 7 unieke inloggegevens (CSV)
   </button>
   <p className="mt-2 text-xs text-zinc-400">Bewaar dit bestand privé. De wachtwoorden worden niet in deze app opgeslagen of opnieuw weergegeven.</p>
  </>}
 </section>
}
