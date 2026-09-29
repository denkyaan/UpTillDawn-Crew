"use client"

import { useCallback, useEffect, useState } from "react"

export type AdminNavigationContext={
  event:string
  workplace:string
  user:string
}

const STORAGE_KEY="upt-admin-navigation-context"
const EMPTY:AdminNavigationContext={event:"",workplace:"",user:""}
const CONTEXT_FEATURES=new Set(["events","workplaces","operations","tasks","sales","incidents"])

function readStored():AdminNavigationContext{
  try{
    const raw=window.localStorage.getItem(STORAGE_KEY)
    if(!raw)return EMPTY
    const parsed=JSON.parse(raw) as Partial<AdminNavigationContext>
    return {
      event:typeof parsed.event==="string"?parsed.event:"",
      workplace:typeof parsed.workplace==="string"?parsed.workplace:"",
      user:typeof parsed.user==="string"?parsed.user:"",
    }
  }catch{return EMPTY}
}

function readUrl():Partial<AdminNavigationContext>{
  const params=new URLSearchParams(window.location.search)
  return {
    event:params.get("event")||"",
    workplace:params.get("workplace")||"",
    user:params.get("user")||"",
  }
}

export function useAdminNavigationContext(enabled:boolean){
  const [context,setContext]=useState<AdminNavigationContext>(EMPTY)

  useEffect(()=>{
    if(!enabled){setContext(EMPTY);return}
    const sync=()=>{
      const stored=readStored()
      const fromUrl=readUrl()
      const next={
        event:fromUrl.event||stored.event,
        workplace:fromUrl.workplace||stored.workplace,
        user:fromUrl.user||stored.user,
      }
      setContext(next)
      try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}
    }
    sync()
    window.addEventListener("popstate",sync)
    return()=>window.removeEventListener("popstate",sync)
  },[enabled])

  const hrefFor=useCallback((href:string,featureKey:string)=>{
    if(!enabled||!CONTEXT_FEATURES.has(featureKey))return href
    const [path,rawQuery=""]=href.split("?")
    const params=new URLSearchParams(rawQuery)
    if(context.event&&!params.has("event"))params.set("event",context.event)
    if(context.workplace&&!params.has("workplace")&&featureKey!=="events")params.set("workplace",context.workplace)
    if(context.user&&!params.has("user")&&["operations","tasks","incidents"].includes(featureKey))params.set("user",context.user)
    const query=params.toString()
    return query?path+"?"+query:path
  },[context,enabled])

  return {context,hrefFor}
}
