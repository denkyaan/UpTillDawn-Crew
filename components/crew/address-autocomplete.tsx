"use client"

import { useEffect,useId,useState } from "react"
import { humanizeAppError } from "@/lib/client-error-message"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

type Suggestion={
  id:string
  name:string
  formatted:string
  addressLine1:string
  addressLine2:string
  latitude:number
  longitude:number
  resultType:string
}

export function AddressAutocomplete({
  name,
  label,
  defaultValue,
  required=false,
}:{
  name:string
  label:string
  defaultValue?:string|null
  required?:boolean
}){
  const id=useId()
  const listId=id+"-list"
  const [value,setValue]=useState(defaultValue||"")
  const [focused,setFocused]=useState(false)
  const [suggestions,setSuggestions]=useState<Suggestion[]>([])
  const [active,setActive]=useState(-1)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState("")
  const [locale,setLocale]=useState<SupportedUiLocale>("nl")
  const t=(nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de})[locale]
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>setLocale(activeUiLocale()))
    const apply=()=>setLocale(activeUiLocale())
    addEventListener(LANGUAGE_APPLIED_EVENT,apply)
    return()=>{cancelAnimationFrame(frame);removeEventListener(LANGUAGE_APPLIED_EVENT,apply)}
  },[])

  useEffect(()=>{
    if(!focused||value.trim().length<2)return
    const controller=new AbortController()
    const timer=window.setTimeout(async()=>{
      try{
        setLoading(true);setError("")
        const htmlLang=document.documentElement.lang.slice(0,2).toLowerCase()
        const lang=["nl","fr","en","de"].includes(htmlLang)?htmlLang:"nl"
        const response=await fetch("/api/geocode/autocomplete?q="+encodeURIComponent(value.trim())+"&lang="+lang,{
          signal:controller.signal,headers:{Accept:"application/json"},
        })
        const payload=await response.json() as {results?:Suggestion[];error?:string}
        if(!response.ok){setSuggestions([]);setError(humanizeAppError(payload.error||t("Adressen konden niet worden opgezocht.","Addresses could not be retrieved.","Impossible de rechercher les adresses.","Adressen konnten nicht abgerufen werden.")));return}
        setSuggestions(payload.results||[]);setActive(-1)
      }catch(fetchError){
        if(fetchError instanceof DOMException&&fetchError.name==="AbortError")return
        setSuggestions([]);setError(humanizeAppError(fetchError))
      }finally{if(!controller.signal.aborted)setLoading(false)}
    },300)
    return()=>{window.clearTimeout(timer);controller.abort()}
  },[focused,value])

  function choose(item:Suggestion){
    setValue(item.formatted)
    setSuggestions([])
    setActive(-1)
    setFocused(false)
    setError("")
  }

  return <label className="relative block">{label}
    <input
      name={name}
      required={required}
      maxLength={500}
      autoComplete="street-address"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={listId}
      aria-expanded={focused&&suggestions.length>0}
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
      placeholder={t("Begin straat, nummer of gemeente te typen","Start typing a street, number or town","Commencez à saisir une rue, un numéro ou une commune","Straße, Hausnummer oder Ort eingeben")}
      className="mt-1 block w-full rounded-xl border bg-background p-3"
    />
    {focused&&<div id={listId} role="listbox" className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-background shadow-xl">
      {loading&&<p className="p-3 text-sm text-muted-foreground">{t("Adressen zoeken…","Searching addresses…","Recherche d’adresses…","Adressen werden gesucht…")}</p>}
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
      {!loading&&value.trim().length>=2&&!suggestions.length&&!error&&<p className="p-3 text-sm text-muted-foreground">{t("Geen adressen gevonden.","No addresses found.","Aucune adresse trouvée.","Keine Adressen gefunden.")}</p>}
      {error&&<p className="p-3 text-sm text-red-500">{error}</p>}
    </div>}
  </label>
}
