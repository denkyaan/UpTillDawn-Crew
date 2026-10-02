"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/providers"

export function DashboardIdentity() {
  const router=useRouter()
  const {profile,isAdmin,loading}=useAuth()

  useEffect(()=>{
    if(!loading&&isAdmin)router.replace("/admin")
  },[isAdmin,loading,router])

  const name=profile?.full_name||(!loading?"Personeelslid":"…")

  return <div>
    <p className="text-xs font-bold tracking-[.2em] text-violet-400">UP TILL DAWN PERSONEELSBEHEER</p>
    <h1 className="mt-1 text-3xl font-black">Welkom, {name}</h1>
    <p className="text-muted-foreground">Je operationele personeelsoverzicht.</p>
  </div>
}
