"use client"

import { useEffect, useState } from "react"
import {
  LANGUAGE_APPLIED_EVENT,
  LANGUAGE_CHANGE_EVENT,
  initialUiLocale,
  parseUiLocale,
  type SupportedUiLocale,
} from "@/lib/locale-preferences"

const languages:{value:SupportedUiLocale;label:string}[]=[
  {value:"nl",label:"Nederlands"},
  {value:"fr",label:"Frans"},
  {value:"en",label:"Engels"},
  {value:"de",label:"Duits"},
]

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const [language,setLanguage]=useState<SupportedUiLocale>("nl")

  useEffect(()=>{
    let cancelled=false
    const sync=(value?:string|null)=>{
      const next=parseUiLocale(value)||initialUiLocale()
      if(!cancelled)setLanguage(next)
    }
    sync(document.documentElement.lang)
    const onApplied=(event:Event)=>sync((event as CustomEvent<string>).detail)
    window.addEventListener(LANGUAGE_APPLIED_EVENT,onApplied)
    return()=>{cancelled=true;window.removeEventListener(LANGUAGE_APPLIED_EVENT,onApplied)}
  },[])

  return <label className={`flex items-center justify-between gap-3 text-sm ${dark?"text-zinc-300":"text-muted-foreground"}`}>
    <span>Taal</span>
    <select
      aria-label="Taal wijzigen"
      value={language}
      onChange={event=>{
        const next=parseUiLocale(event.target.value)||"nl"
        setLanguage(next)
        window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT,{detail:next}))
      }}
      className={`rounded-lg border px-3 py-2 ${dark?"border-white/15 bg-black text-white":"bg-background text-foreground"}`}
    >
      {languages.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  </label>
}
