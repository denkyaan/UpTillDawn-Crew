'use client'

import { useState,useSyncExternalStore } from 'react'
import {localDateInputValue,localDateInputLabel} from '@/lib/date-input'

function subscribeTimezone(update:()=>void){
 window.addEventListener('focus',update)
 return()=>window.removeEventListener('focus',update)
}

export function DateInput({ name, initial, required = true,label }: { name: string; initial?: string; required?: boolean;label?:string }) {
  const [iso, setIso] = useState(initial || '')
  const [editedLocal,setEditedLocal]=useState<string|null>(null)
  // SSR and the hydration render use UTC; only the subscribed client snapshot
  // applies the device offset. Saved UTC instants never change during hydration.
  const offset=useSyncExternalStore(subscribeTimezone,()=>{
    const date=new Date(iso||Date.now())
    return Number.isFinite(date.getTime())?date.getTimezoneOffset():0
  },()=>0)
  const local=editedLocal??localDateInputValue(iso,offset)

  return <label className="grid gap-1 text-sm">
    <span>{label??localDateInputLabel(name)} <span className="text-xs text-muted-foreground">Lokale tijd</span></span>
    <input
      type="datetime-local"
      required={required}
      value={local}
      className="rounded-lg border bg-background p-3"
      onChange={e => {
        setEditedLocal(e.target.value)
        const date=new Date(e.target.value)
        setIso(e.target.value&&Number.isFinite(date.getTime())?date.toISOString():'')
      }}
    />
    <input type="hidden" name={name} value={iso}/>
  </label>
}
