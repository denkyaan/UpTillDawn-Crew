'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

const COOKIE='upt-save-success'
type MessageKey='saved'|'event_archived'|'event_restored'|'event_closed'|'event_duplicated'
const MESSAGES:Record<MessageKey,{nl:string;fr:string;en:string;de:string}>={
  saved:{nl:'Succesvol opgeslagen.',fr:'Enregistré avec succès.',en:'Saved successfully.',de:'Erfolgreich gespeichert.'},
  event_archived:{nl:'Evenement gearchiveerd.',fr:'Événement archivé.',en:'Event archived.',de:'Veranstaltung archiviert.'},
  event_restored:{nl:'Evenement hersteld.',fr:'Événement restauré.',en:'Event restored.',de:'Veranstaltung wiederhergestellt.'},
  event_closed:{nl:'Evenement afgesloten.',fr:'Événement clôturé.',en:'Event closed.',de:'Veranstaltung abgeschlossen.'},
  event_duplicated:{nl:'Evenement gedupliceerd.',fr:'Événement dupliqué.',en:'Event duplicated.',de:'Veranstaltung dupliziert.'},
}
function localeKey(){
  const locale=(document.documentElement.lang||'nl').toLowerCase()
  if(locale.startsWith('fr'))return 'fr' as const
  if(locale.startsWith('de'))return 'de' as const
  if(locale.startsWith('en'))return 'en' as const
  return 'nl' as const
}
function message(key:string){
  const normalized=(key in MESSAGES?key:'saved') as MessageKey
  return MESSAGES[normalized][localeKey()]
}
export function SaveSuccessToaster(){
  useEffect(()=>{
    const check=()=>{
      const entry=document.cookie.split('; ').find(item=>item.startsWith(COOKIE+'='))
      if(!entry)return
      const raw=entry.slice(COOKIE.length+1)
      document.cookie=`${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
      let key='saved'
      try{key=decodeURIComponent(raw||'saved')}catch{}
      toast.success(message(key))
    }
    check()
    const timer=window.setInterval(check,350)
    window.addEventListener('focus',check)
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',check)}
  },[])
  return null
}
