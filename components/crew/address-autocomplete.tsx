"use client"

import { useEffect,useId,useState } from "react"
import { humanizeAppError } from "@/lib/client-error-message"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

export type AddressSuggestion={
  id:string
  name:string
  formatted:string
  addressLine1:string
  addressLine2:string
  latitude:number
  longitude:number
  resultType:string
  streetAddress:string
  postalCode:string
  city:string
  countryCode:string
}

export function AddressAutocomplete({
  name,
  label,
  defaultValue,
  required=false,
  onSelect,
}:{
  name:string
  label:string
  defaultValue?:string|null
  required?:boolean
  onSelect?:(suggestion:AddressSuggestion)=>void
}){
  const id=useId()
  const listId=id+"-list"
  const [value,setValue]=useState(defaultValue||"")
  const [focused,setFocused]=useState(false)
  const [suggestions,setSuggestions]=useState<AddressSuggestion[]>([])
  const [onlineLookup,setOnlineLookup]=useState(false)
  const [locale,setLocale]=useState<SupportedUiLocale>("nl")
  useEffect(()=>{const sync=()=>setLocale(activeUiLocale());sync();window.addEventListener(LANGUAGE_APPLIED_EVENT,sync);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,sync)},[])
  const [active,setActive]=useState(-1)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState("")

  useEffect(()=>{
    if(!onlineLookup||!focused||value.trim().length<2||!navigator.onLine)return
    const controller=new AbortController()
    const timer=window.setTimeout(async()=>{
      try{
        setLoading(true);setError("")
        const htmlLang=document.documentElement.lang.slice(0,2).toLowerCase()
        const lang=["nl","fr","en"].includes(htmlLang)?htmlLang:"nl"
        const response=await fetch("/api/geocode/autocomplete?q="+encodeURIComponent(value.trim())+"&lang="+lang,{
          signal:controller.signal,headers:{Accept:"application/json"},
        })
        const payload=await response.json() as {results?:AddressSuggestion[];error?:string}
        if(!response.ok){setSuggestions([]);setError(humanizeAppError(payload.error||"Adressen konden niet worden opgezocht."));return}
        setSuggestions(payload.results||[]);setActive(-1)
      }catch(fetchError){
        if(fetchError instanceof DOMException&&fetchError.name==="AbortError")return
        setSuggestions([]);setError(humanizeAppError(fetchError))
      }finally{if(!controller.signal.aborted)setLoading(false)}
    },300)
    return()=>{window.clearTimeout(timer);controller.abort()}
  },[focused,value,onlineLookup])

  function choose(item:AddressSuggestion){
    setValue(item.formatted)
    setSuggestions([])
    setActive(-1)
    setFocused(false)
    setError("")
    onSelect?.(item)
  }

  const words={
    nl:{opt:"Adres online opzoeken (optioneel)",manual:"Adres handmatig invoeren is gratis en werkt zonder adres-API",placeholder:"Straat, huisnummer, postcode en gemeente",loading:"Adressen zoeken…",empty:"Geen adressen gevonden."},
    fr:{opt:"Rechercher une adresse en ligne (facultatif)",manual:"La saisie manuelle est gratuite et ne nécessite pas d’API d’adresses",placeholder:"Rue, numéro, code postal et ville",loading:"Recherche d’adresses…",empty:"Aucune adresse trouvée."},
    en:{opt:"Look up address online (optional)",manual:"Manual entry is free and needs no address API",placeholder:"Street, number, postal code and city",loading:"Searching addresses…",empty:"No addresses found."},
    de:{opt:"Adresse online suchen (optional)",manual:"Die manuelle Eingabe ist kostenlos und benötigt keine Adress-API",placeholder:"Straße, Hausnummer, Postleitzahl und Ort",loading:"Adressen werden gesucht…",empty:"Keine Adressen gefunden."}
  } as const
  const labels=words[locale]

  return <div className="relative block"><label htmlFor={id} className="block text-sm">{label}</label>
    <input
      id={id}
      name={name}
      required={required}
      maxLength={500}
      autoComplete="street-address"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={listId}
      aria-expanded={onlineLookup&&focused&&suggestions.length>0}
      value={value}
      onFocus={()=>setFocused(true)}
      onBlur={()=>window.setTimeout(()=>{setFocused(false);setSuggestions([])},120)}
      onChange={e=>{
        const next=e.target.value
        setValue(next);setActive(-1);setError("")
        if(next.trim().length<2){setSuggestions([]);setLoading(false)}
      }}
      onKeyDown={e=>{
        if(!suggestions.length)return
        if(e.key==="ArrowDown"){e.preventDefault();setActive(i=>Math.min(i+1,suggestions.length-1))}
        else if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(i-1,0))}
        else if(e.key==="Enter"&&active>=0){e.preventDefault();choose(suggestions[active])}
        else if(e.key==="Escape"){setSuggestions([]);setActive(-1)}
      }}
      placeholder={labels.placeholder}
      className="mt-1 block w-full rounded-xl border bg-background p-3"
    />
    <label className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={onlineLookup} onChange={event=>{setOnlineLookup(event.target.checked);setSuggestions([]);setError("");setLoading(false)}}/> {labels.opt}</label>
    {!onlineLookup&&<span className="block text-xs text-muted-foreground">{labels.manual}</span>}
    {onlineLookup&&focused&&<div id={listId} role="listbox" className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-background shadow-xl">
      {loading&&<p className="p-3 text-sm text-muted-foreground">{labels.loading}</p>}
      {!loading&&suggestions.map((item,index)=><button
        key={item.id}
        type="button"
        role="option"
        aria-selected={active===index}
        onMouseDown={e=>e.preventDefault()}
        onClick={()=>choose(item)}
        className={"block w-full border-b p-3 text-left last:border-b-0 "+(active===index?"bg-muted":"")}
      >
        <span className="block font-semibold">{item.addressLine1||item.name}</span>
        <span className="block text-xs text-muted-foreground">{item.formatted}</span>
      </button>)}
      {!loading&&value.trim().length>=2&&!suggestions.length&&!error&&<p className="p-3 text-sm text-muted-foreground">{labels.empty}</p>}
      {error&&<p className="p-3 text-sm text-red-500">{error}</p>}
    </div>}
  </div>
}
