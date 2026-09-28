"use client"

import { useEffect, useState } from "react"
import {
  LANGUAGE_APPLIED_EVENT,
  initialAppLocale,
  parseAppLocale,
  requestAppLocale,
  type AppLocale,
} from "@/lib/locale"

const languages:{value:AppLocale;label:string}[] = [
  { value: "nl", label: "Nederlands" },
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
]

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const [language, setLanguage] = useState<AppLocale>("nl")

  useEffect(() => {
    let cancelled=false
    const sync=(value?:string|null)=>{
      const next=parseAppLocale(value)||initialAppLocale()
      if(!cancelled)setLanguage(next)
    }
    sync(document.documentElement.lang)
    const onApplied=(event:Event)=>sync((event as CustomEvent<string>).detail)
    window.addEventListener(LANGUAGE_APPLIED_EVENT,onApplied)
    return()=>{
      cancelled=true
      window.removeEventListener(LANGUAGE_APPLIED_EVENT,onApplied)
    }
  },[])

  return <label className={`flex items-center justify-between gap-3 text-sm ${dark ? "text-zinc-300" : "text-muted-foreground"}`}>
    <span>Taal</span>
    <select
      aria-label="Taal wijzigen"
      value={language}
      onChange={event=>{
        const next=parseAppLocale(event.target.value)||"nl"
        setLanguage(next)
        requestAppLocale(next)
      }}
      className={`rounded-lg border px-3 py-2 ${dark ? "border-white/15 bg-black text-white" : "bg-background text-foreground"}`}
    >
      {languages.map(item=><option data-no-translate key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  </label>
}
