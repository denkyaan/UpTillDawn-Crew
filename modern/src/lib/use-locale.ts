import {useEffect,useSyncExternalStore} from "react"
import {copy,deviceLocale,resolveLocale,type Locale} from "../shared/i18n"

const EVENT="uptilldawn-modern-locale"
function read():Locale{
 if(typeof window==="undefined")return "nl"
 try{return resolveLocale(localStorage.getItem("uptilldawn-modern-locale")||deviceLocale())}catch{return deviceLocale()}
}
const subscribe=(callback:()=>void)=>{addEventListener(EVENT,callback);return()=>removeEventListener(EVENT,callback)}
export function setLocale(locale:Locale){
 try{localStorage.setItem("uptilldawn-modern-locale",locale)}catch{}
 document.documentElement.lang=locale
 dispatchEvent(new Event(EVENT))
}
export function useLocale(){const locale=useSyncExternalStore(subscribe,read,()=> "nl" as Locale);useEffect(()=>{document.documentElement.lang=locale},[locale]);return {locale,t:copy(locale)}}
