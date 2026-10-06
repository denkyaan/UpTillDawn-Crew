"use client"

import {useRef,useState} from "react"
import {deletePersonnel} from "@/lib/actions/personnel"
import {PendingSubmitButton} from "@/components/ui/pending-submit-button"

export function PersonnelDeleteButton({userId,name}:{userId:string;name:string}){
  const dialog=useRef<HTMLDialogElement>(null)
  const [confirmation,setConfirmation]=useState("")
  const matches=confirmation.trim()===name.trim()

  return <>
    <button type="button" onClick={()=>{setConfirmation("");dialog.current?.showModal()}} className="rounded-lg border border-red-500/60 px-4 py-2 font-semibold text-red-500">
      DEFINITIEF VERWIJDEREN
    </button>
    <dialog ref={dialog} className="w-[min(92vw,34rem)] rounded-2xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/70">
      <form action={deletePersonnel} className="space-y-4 p-5">
        <input type="hidden" name="user_id" value={userId}/>
        <div>
          <h2 className="text-xl font-black text-red-500">Account definitief verwijderen?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Dit verwijdert het account en persoonlijke toewijzingen. Operationele auditgegevens blijven behouden waar dat vereist is. Deze actie kan niet via de normale interface worden teruggedraaid.</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-sm">Typ de volledige naam om te bevestigen:</p>
          <p className="mt-1 font-black">{name}</p>
          <input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" className="mt-3 w-full rounded-lg border bg-background p-3" aria-label="Volledige naam ter bevestiging"/>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={()=>dialog.current?.close()} className="rounded-xl border px-4 py-3 font-bold">Annuleren</button>
          <PendingSubmitButton disabled={!matches} pendingLabel="VERWIJDEREN…" className="rounded-xl bg-red-700 px-4 py-3 font-black text-white disabled:opacity-40">
            DEFINITIEF VERWIJDEREN
          </PendingSubmitButton>
        </div>
      </form>
    </dialog>
  </>
}
