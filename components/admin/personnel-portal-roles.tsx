"use client"
import {useState,useTransition} from "react"
import {useRouter} from "next/navigation"
import {changePortalRole} from "@/lib/actions/portal-roles"
const roles={events:[["event_staff","Personeel"],["event_responsible","Verantwoordelijke"]],promotion:[["promoter","Promotie"]],administration:[["administrative_staff","Administratie"]]} as const
type Portal=keyof typeof roles
type Assignment={portal:string;role:string;approved:boolean;revoked_at:string|null}
export function PersonnelPortalRoles({userId,assignments,readOnly=false}:{userId:string;assignments:Assignment[];readOnly?:boolean}){
 const router=useRouter()
 const [portal,setPortal]=useState<Portal>("events")
 const [role,setRole]=useState<string>("event_staff")
 const [pending,start]=useTransition()
 const [message,setMessage]=useState("")
 const selectedAssignment=assignments.find(a=>a.portal===portal&&a.role===role&&!a.revoked_at)
 const activeSelected=Boolean(selectedAssignment?.approved)
 const pendingSelected=Boolean(selectedAssignment&&!selectedAssignment.approved)
 function update(action:"assign_approved"|"approve"|"revoke",p=portal,r=role){
  setMessage("")
  const form=new FormData()
  form.set("user_id",userId);form.set("portal",p);form.set("role",r);form.set("action",action)
  start(async()=>{try{await changePortalRole(form)setMessage("Rolwijziging opgeslagen.");router.refresh()}catch{setMessage("Rolwijziging niet uitgevoerd.");router.refresh()}})
 }
 return <section className="mt-3 space-y-3 rounded-xl border p-3">
  <h3 className="font-semibold">Extra portaalrollen</h3>
  <p className="text-xs text-muted-foreground">Een medewerker kan tegelijk toegang hebben tot Evenementen, Promotie en Administratie. De basisrol blijft afzonderlijk bestaan.</p>
  <div className="flex flex-wrap gap-2">{assignments.filter(a=>!a.revoked_at).map(a=><div key={a.portal+":"+a.role} className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs"><span>{a.portal==="events"?"Evenementen":a.portal==="promotion"?"Promotie":"Administratie"} · {a.role==="event_staff"?"Personeel":a.role==="event_responsible"?"Verantwoordelijke":a.role==="promoter"?"Promotie":"Administratie"} · {a.approved?"Actief":"Wacht op goedkeuring"}</span>{!readOnly&&!a.approved&&<button disabled={pending} type="button" onClick={()=>update("approve",a.portal as Portal,a.role)} className="text-violet-400 underline">Goedkeuren</button>}{!readOnly&&<button disabled={pending} type="button" onClick={()=>update("revoke",a.portal as Portal,a.role)} className="text-red-400 underline">Intrekken</button>}</div>)}</div>
  {!readOnly&&<div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Portaal<select value={portal} onChange={e=>{const p=e.target.value as Portal;setPortal(p);setRole(roles[p][0][0])}} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="events">Evenementen</option><option value="promotion">Promotie</option><option value="administration">Administratie</option></select></label><label className="text-sm">Rol<select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2">{roles[portal].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>}
  {!readOnly&&<div className="flex flex-wrap items-center gap-2">{activeSelected?<span className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-semibold text-emerald-600">Rol al actief</span>:pendingSelected?<button type="button" disabled={pending} onClick={()=>update("approve")} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Rol goedkeuren</button>:<button type="button" disabled={pending} onClick={()=>update("assign_approved")} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Extra rol toewijzen</button>}</div>}
  {message&&<p role="status" className="text-xs">{message}</p>}
 </section>
}
