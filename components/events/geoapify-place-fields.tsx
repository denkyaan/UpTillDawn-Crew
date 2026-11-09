"use client"

import { useEffect, useId, useMemo, useState } from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"


const localCopy={
 nl:{lookup:"Online locatie- en adressuggesties gebruiken (optioneel; kan API-verbruik veroorzaken)",latitude:"Breedtegraad (optioneel, handmatig)",longitude:"Lengtegraad (optioneel, handmatig)",hint:"Locatie en adres kun je zonder API handmatig invullen. Voor GPS-check-in zijn geverifieerde coördinaten nodig; zonder coördinaten kan de GPS-afstandscontrole niet werken. Online suggesties zijn optioneel."},
 fr:{lookup:"Utiliser les suggestions de lieux et d'adresses en ligne (facultatif, peut entraîner une utilisation de l'API)",latitude:"Latitude (facultatif, saisie manuelle)",longitude:"Longitude (facultatif, saisie manuelle)",hint:"Vous pouvez saisir le lieu et l'adresse sans API. Des coordonnées vérifiées sont nécessaires au contrôle GPS à l’arrivée. La recherche en ligne reste facultative."},
 en:{lookup:"Use online place and address suggestions (optional; may use API quota)",latitude:"Latitude (optional, manual)",longitude:"Longitude (optional, manual)",hint:"Enter the venue and address without an API. Verified coordinates are required for GPS check-in; without them GPS distance verification cannot work. Online lookup is optional."},
 de:{lookup:"Online-Orts- und Adressvorschläge verwenden (optional; kann API-Kontingent verbrauchen)",latitude:"Breitengrad (optional, manuell)",longitude:"Längengrad (optional, manuell)",hint:"Ort und Adresse können ohne API manuell eingegeben werden. Für die GPS-Check-in-Prüfung werden verifizierte Koordinaten benötigt. Online-Suche bleibt optional."}
} as const

type Props = {
  defaultVenue?: string | null
  defaultAddress?: string | null
  defaultLatitude?: number | null
  defaultLongitude?: number | null
}

type Suggestion = {
  id:string
  name:string
  formatted:string
  addressLine1:string
  addressLine2:string
  latitude:number
  longitude:number
  resultType:string
}

type Field="venue"|"address"

export function GeoapifyPlaceFields({
  defaultVenue,
  defaultAddress,
  defaultLatitude,
  defaultLongitude,
}:Props){
  const [locale,setLocale]=useState<SupportedUiLocale>("nl")
  useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
  const t=localCopy[locale]
  const fieldId=useId()
  const venueId=`${fieldId}-venue`
  const addressId=`${fieldId}-address`
  const venueListId=`${fieldId}-venue-list`
  const addressListId=`${fieldId}-address-list`
  const [venue,setVenue]=useState(defaultVenue||"")
  const [address,setAddress]=useState(defaultAddress||"")
  const [latitude,setLatitude]=useState(defaultLatitude?.toString()||"")
  const [longitude,setLongitude]=useState(defaultLongitude?.toString()||"")
  const [focused,setFocused]=useState<Field|null>(null)
  const [suggestions,setSuggestions]=useState<Suggestion[]>([])
  const [activeIndex,setActiveIndex]=useState(-1)
  const [loading,setLoading]=useState(false)
  const [onlineLookup,setOnlineLookup]=useState(false)
  const [error,setError]=useState("")

  const query=focused==="venue"?venue:focused==="address"?address:""
  const mapsUri=useMemo(()=>{
    if(!latitude||!longitude)return ""
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
  },[latitude,longitude])

  useEffect(()=>{
    // Manual fields are the free/offline default; Geoapify is explicit opt-in.
    if(!onlineLookup||!focused||query.trim().length<2||!navigator.onLine)return

    const controller=new AbortController()
    const timer=window.setTimeout(async()=>{
      try{
        setLoading(true)
        setError("")
        const htmlLang=document.documentElement.lang.slice(0,2).toLowerCase()
        const lang=["nl","fr","en"].includes(htmlLang)?htmlLang:"nl"
        const response=await fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(query.trim())}&lang=${lang}`,{
          signal:controller.signal,
          headers:{Accept:"application/json"},
        })
        const payload=await response.json() as {results?:Suggestion[];error?:string}
        if(!response.ok){
          setSuggestions([])
          setError(payload.error||"Locaties konden niet worden opgezocht.")
          return
        }
        setSuggestions(payload.results||[])
        setActiveIndex(-1)
      }catch(fetchError){
        if(fetchError instanceof DOMException&&fetchError.name==="AbortError")return
        setSuggestions([])
        setError("Locaties konden niet worden opgezocht.")
      }finally{
        if(!controller.signal.aborted)setLoading(false)
      }
    },300)

    return()=>{
      window.clearTimeout(timer)
      controller.abort()
    }
  },[focused,query,onlineLookup])

  const clearLink=()=>{
    setLatitude("")
    setLongitude("")
  }

  const focusField=(field:Field)=>{
    setFocused(field)
    setSuggestions([])
    setActiveIndex(-1)
    setError("")
  }

  const editField=(field:Field,value:string)=>{
    if(field==="venue")setVenue(value)
    else setAddress(value)
    clearLink()
    setFocused(field)
    setActiveIndex(-1)
    setError("")
    if(value.trim().length<2){
      setSuggestions([])
      setLoading(false)
    }
  }

  const blurField=(field:Field)=>{
    window.setTimeout(()=>{
      setFocused(current=>current===field?null:current)
      setSuggestions([])
      setActiveIndex(-1)
    },120)
  }

  const selectSuggestion=(suggestion:Suggestion)=>{
    setVenue(suggestion.name||suggestion.addressLine1||suggestion.formatted)
    setAddress(suggestion.formatted)
    setLatitude(String(suggestion.latitude))
    setLongitude(String(suggestion.longitude))
    setSuggestions([])
    setActiveIndex(-1)
    setFocused(null)
    setError("")
  }

  const handleKeyDown=(event:React.KeyboardEvent<HTMLInputElement>)=>{
    if(!suggestions.length)return
    if(event.key==="ArrowDown"){
      event.preventDefault()
      setActiveIndex(index=>Math.min(index+1,suggestions.length-1))
    }else if(event.key==="ArrowUp"){
      event.preventDefault()
      setActiveIndex(index=>Math.max(index-1,0))
    }else if(event.key==="Enter"&&activeIndex>=0){
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    }else if(event.key==="Escape"){
      setSuggestions([])
      setActiveIndex(-1)
    }
  }

  const suggestionList=(field:Field)=>{
    if(focused!==field)return null
    return <div id={field==="venue"?venueListId:addressListId} className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-background shadow-xl" role="listbox">
      {loading&&<p className="p-3 text-sm text-muted-foreground">Locaties zoeken…</p>}
      {!loading&&suggestions.map((suggestion,index)=><button
        key={suggestion.id}
        type="button"
        role="option"
        aria-selected={activeIndex===index}
        onMouseDown={event=>event.preventDefault()}
        onClick={()=>selectSuggestion(suggestion)}
        className={`block w-full border-b p-3 text-left last:border-b-0 ${activeIndex===index?"bg-muted":""}`}
      >
        <span className="block font-semibold">{suggestion.name}</span>
        <span className="block text-xs text-muted-foreground">{suggestion.formatted}</span>
      </button>)}
      {!loading&&query.trim().length>=2&&!suggestions.length&&!error&&<p className="p-3 text-sm text-muted-foreground">Geen locaties gevonden.</p>}
    </div>
  }

  return <div className="grid gap-3 md:grid-cols-2">
    <label className="md:col-span-2 flex items-center gap-2 text-xs">
      <input type="checkbox" checked={onlineLookup} onChange={event=>{setOnlineLookup(event.target.checked);setSuggestions([]);setError("");setLoading(false)}}/>
      {t.lookup}
    </label>
    <div className="relative grid gap-1 text-sm">
      <label htmlFor={venueId}>Locatie</label>
      <input
        id={venueId}
        value={venue}
        onChange={event=>editField("venue",event.target.value)}
        onFocus={()=>focusField("venue")}
        onBlur={()=>blurField("venue")}
        onKeyDown={handleKeyDown}
        maxLength={200}
        placeholder="Zoek locatie"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={venueListId}
        aria-expanded={focused==="venue"&&suggestions.length>0}
        className="rounded-lg border bg-background p-3"
      />
      {suggestionList("venue")}
    </div>

    <div className="relative grid gap-1 text-sm">
      <label htmlFor={addressId}>Adres</label>
      <input
        id={addressId}
        value={address}
        onChange={event=>editField("address",event.target.value)}
        onFocus={()=>focusField("address")}
        onBlur={()=>blurField("address")}
        onKeyDown={handleKeyDown}
        maxLength={500}
        placeholder="Zoek adres"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={addressListId}
        aria-expanded={focused==="address"&&suggestions.length>0}
        className="rounded-lg border bg-background p-3"
      />
      {suggestionList("address")}
    </div>

    <input type="hidden" name="venue" value={venue}/>
    <input type="hidden" name="address" value={address}/>
    <label className="grid gap-1 text-sm">{t.latitude}
      <input type="number" inputMode="decimal" step="any" min="-90" max="90" name="latitude" required={Boolean(longitude)} value={latitude} onChange={event=>setLatitude(event.target.value)} className="rounded-lg border bg-background p-3"/>
    </label>
    <label className="grid gap-1 text-sm">{t.longitude}
      <input type="number" inputMode="decimal" step="any" min="-180" max="180" name="longitude" required={Boolean(latitude)} value={longitude} onChange={event=>setLongitude(event.target.value)} className="rounded-lg border bg-background p-3"/>
    </label>

    <div className="md:col-span-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span>{t.hint}</span>
      {mapsUri&&<a href={mapsUri} target="_blank" rel="noreferrer" className="underline">Open adres in Google Maps</a>}
      <span>
        Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="underline">Geoapify</a>
        {" · "}
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>
      </span>
      {error&&<span className="font-semibold text-red-500">{error}</span>}
    </div>
  </div>
}
