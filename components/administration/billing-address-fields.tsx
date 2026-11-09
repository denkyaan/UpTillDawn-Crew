"use client"

import {useState} from "react"
import {AddressAutocomplete,type AddressSuggestion} from "@/components/crew/address-autocomplete"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

export type BillingAddressDefaults={
 street_address?:string|null
 postal_code?:string|null
 city?:string|null
 country_code?:string|null
}
const copy={
 nl:{search:"Adres opzoeken (optioneel)",street:"Straat en huisnummer",postal:"Postcode",city:"Gemeente",country:"Landcode (BE)",hint:"Je kunt alles handmatig invoeren. Online zoeken is optioneel en wordt pas na aanvinken gebruikt."},
 fr:{search:"Rechercher une adresse (facultatif)",street:"Rue et numéro",postal:"Code postal",city:"Ville",country:"Code pays (BE)",hint:"Tous les champs peuvent être remplis manuellement. La recherche en ligne est facultative."},
 en:{search:"Look up address (optional)",street:"Street and number",postal:"Postal code",city:"City",country:"Country code (BE)",hint:"All fields can be entered manually. Online lookup is optional and only runs when enabled."},
 de:{search:"Adresse suchen (optional)",street:"Straße und Hausnummer",postal:"Postleitzahl",city:"Ort",country:"Ländercode (BE)",hint:"Alle Felder können manuell ausgefüllt werden. Die Online-Suche ist optional."}
} as const

export function BillingAddressFields({locale,defaults={},className="sm:col-span-2"}:{
 locale:SupportedUiLocale
 defaults?:BillingAddressDefaults
 className?:string
}){
 const t=copy[locale]
 const [street,setStreet]=useState(defaults.street_address??"")
 const [postal,setPostal]=useState(defaults.postal_code??"")
 const [city,setCity]=useState(defaults.city??"")
 const [country,setCountry]=useState((defaults.country_code??"BE").toUpperCase())
 function choose(item:AddressSuggestion){
  // Each returned component is independently editable. Unspecified values
  // are preserved; never overwrite a manually filled field with empty data.
  if(item.streetAddress)setStreet(item.streetAddress.slice(0,300))
  if(item.postalCode)setPostal(item.postalCode.slice(0,32))
  if(item.city)setCity(item.city.slice(0,120))
  if(item.countryCode)setCountry(item.countryCode.slice(0,2))
 }
 return <div className={className+" grid gap-3 sm:grid-cols-2"} data-billing-address-fields>
  <div className="sm:col-span-2"><AddressAutocomplete name="address_lookup" label={t.search} onSelect={choose}/></div>
  <label className="grid gap-1 text-sm">{t.street}<input name="street_address" maxLength={300} value={street} onChange={e=>setStreet(e.target.value)} autoComplete="address-line1" className="w-full rounded-lg border bg-background p-3"/></label>
  <label className="grid gap-1 text-sm">{t.postal}<input name="postal_code" maxLength={32} value={postal} onChange={e=>setPostal(e.target.value)} autoComplete="postal-code" className="w-full rounded-lg border bg-background p-3"/></label>
  <label className="grid gap-1 text-sm">{t.city}<input name="city" maxLength={120} value={city} onChange={e=>setCity(e.target.value)} autoComplete="address-level2" className="w-full rounded-lg border bg-background p-3"/></label>
  <label className="grid gap-1 text-sm">{t.country}<input name="country_code" maxLength={2} pattern="[a-zA-Z]{2}" value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} autoComplete="country" className="w-full rounded-lg border bg-background p-3 uppercase"/></label>
  <p className="text-xs text-muted-foreground sm:col-span-2">{t.hint}</p>
 </div>
}
