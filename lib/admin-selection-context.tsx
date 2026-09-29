"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type AdminSelection={
  eventId:string|null
  workplaceId:string|null
  userId:string|null
  shiftId:string|null
  focus:string|null
}
type Patch=Partial<AdminSelection>
type Value={
  selection:AdminSelection
  setSelection:(patch:Patch)=>void
  clearSelection:()=>void
  href:(base:string,patch?:Patch)=>string
}
const EMPTY:AdminSelection={eventId:null,workplaceId:null,userId:null,shiftId:null,focus:null}
const KEY="uptilldawn-admin-selection-v1"
const Context=createContext<Value|null>(null)

function encodeHref(base:string,selection:AdminSelection){
  const [path,hashPart]=base.split("#",2)
  const [pathname,queryPart]=path.split("?",2)
  const params=new URLSearchParams(queryPart||"")
  const pairs:[keyof AdminSelection,string][]=[
    ["eventId","event"],["workplaceId","workplace"],["userId","user"],["shiftId","shift"],["focus","focus"],
  ]
  for(const [key,param] of pairs){
    const value=selection[key]
    if(value)params.set(param,value)
    else params.delete(param)
  }
  const query=params.toString()
  return pathname+(query?"?"+query:"")+(hashPart?"#"+hashPart:"")
}

export function AdminSelectionProvider({children}:{children:React.ReactNode}){
  const [selection,setState]=useState<AdminSelection>(EMPTY)

  useEffect(()=>{
    try{
      const stored=window.localStorage.getItem(KEY)
      if(stored)setState(current=>({...current,...JSON.parse(stored)}))
      const params=new URLSearchParams(window.location.search)
      const fromUrl:Patch={
        eventId:params.get("event"),
        workplaceId:params.get("workplace"),
        userId:params.get("user"),
        shiftId:params.get("shift"),
        focus:params.get("focus"),
      }
      if(Object.values(fromUrl).some(Boolean))setState(current=>({...current,...fromUrl}))
    }catch{}
  },[])

  const setSelection=useCallback((patch:Patch)=>{
    setState(current=>{
      const next={...current,...patch}
      try{window.localStorage.setItem(KEY,JSON.stringify(next))}catch{}
      return next
    })
  },[])

  const clearSelection=useCallback(()=>{
    setState(EMPTY)
    try{window.localStorage.removeItem(KEY)}catch{}
  },[])

  const href=useCallback((base:string,patch:Patch={})=>encodeHref(base,{...selection,...patch}),[selection])
  const value=useMemo(()=>({selection,setSelection,clearSelection,href}),[selection,setSelection,clearSelection,href])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useAdminSelection(){
  const value=useContext(Context)
  if(!value)throw new Error("useAdminSelection must be used inside AdminSelectionProvider")
  return value
}
