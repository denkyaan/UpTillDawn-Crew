"use client"

import { archiveEvent } from "@/lib/actions/events"

export function DeleteEventButton({eventId,eventName}:{eventId:string;eventName:string}){
  return <form action={archiveEvent} onSubmit={event=>{
    if(!window.confirm(`Evenement “${eventName}” archiveren? Historische gegevens blijven bewaard en het event verdwijnt uit actieve overzichten.`)){
      event.preventDefault()
    }
  }}>
    <input type="hidden" name="event_id" value={eventId}/>
    <button className="rounded-lg border border-red-500/50 px-3 py-2 font-bold text-red-300">Archiveren</button>
  </form>
}
