'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

const COOKIE='upt-save-success'

function message(){
  const locale=(document.documentElement.lang||'nl').toLowerCase()
  if(locale.startsWith('fr'))return 'Enregistré avec succès.'
  if(locale.startsWith('de'))return 'Erfolgreich gespeichert.'
  if(locale.startsWith('en'))return 'Saved successfully.'
  return 'Succesvol opgeslagen.'
}

export function SaveSuccessToaster(){
  useEffect(()=>{
    const check=()=>{
      const found=document.cookie
        .split('; ')
        .some(entry=>entry.startsWith(COOKIE+'='))
      if(!found)return
      document.cookie=`${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
      toast.success(message())
    }

    check()
    const timer=window.setInterval(check,350)
    window.addEventListener('focus',check)
    return()=>{
      window.clearInterval(timer)
      window.removeEventListener('focus',check)
    }
  },[])

  return null
}
