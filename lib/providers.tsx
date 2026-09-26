"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/crew-client"
import { clearOfflineIdentity } from "@/lib/crew-offline-snapshot"

export type UiRole = "employee" | "responsible_lead" | "admin"

interface UserProfile {
  id: string
  full_name: string
  profile_photo_url: string | null
  approved: boolean
  role: "staff" | "responsible_lead" | "admin"
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  roles: UiRole[]
  isAdmin: boolean
  realIsAdmin: boolean
  isOwner: boolean
  roleMode: UiRole | null
  setRoleMode: (role: UiRole) => Promise<void>
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({user:null,session:null,profile:null,roles:[],isAdmin:false,realIsAdmin:false,isOwner:false,roleMode:null,setRoleMode:async()=>{},loading:true,refreshProfile:async()=>{}})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase=useMemo(()=>createClient(),[])
  const [user,setUser]=useState<User|null>(null)
  const [session,setSession]=useState<Session|null>(null)
  const [profile,setProfile]=useState<UserProfile|null>(null)
  const [roles,setRoles]=useState<UiRole[]>([])
  const [roleMode,setRoleModeState]=useState<UiRole|null>(null)
  const [isOwner,setIsOwner]=useState(false)
  const [loading,setLoading]=useState(true)
  const userRef=useRef<User|null>(null)
  const profileRequestRef=useRef<Promise<void>|null>(null)
  const lastProfileLoadRef=useRef(0)

  useEffect(()=>{userRef.current=user},[user])

  const loadProfile=useCallback(async(userId:string,force=false)=>{
    const now=Date.now()
    if(!force&&now-lastProfileLoadRef.current<15_000)return
    if(profileRequestRef.current)return profileRequestRef.current

    const request=(async()=>{
      const [{data,error},{data:ownerFlag},{data:effectiveRole,error:effectiveRoleError}]=await Promise.all([
        supabase.from("profiles").select("id,full_name,profile_photo_url,approved,role").eq("id",userId).single(),
        supabase.rpc("upt_current_is_owner"),
        supabase.rpc("upt_current_effective_role"),
      ])
      lastProfileLoadRef.current=Date.now()
      const role=data?.role
      const owner=ownerFlag===true
      if(error||!data||(!data.approved&&!owner)||(role!=="staff"&&role!=="responsible_lead"&&role!=="admin")){
        setProfile(null);setRoles([]);setRoleModeState(null);setIsOwner(false);return
      }
      setIsOwner(owner)
      setProfile({id:data.id,full_name:data.full_name??"",profile_photo_url:data.profile_photo_url,approved:data.approved||owner,role})
      const baseUiRole:UiRole=role==="staff"?"employee":role
      const resolved:UiRole=!effectiveRoleError&&effectiveRole==="responsible_lead"?"responsible_lead":!effectiveRoleError&&(effectiveRole==="staff"||effectiveRole==="employee")?"employee":!effectiveRoleError&&effectiveRole==="admin"?"admin":baseUiRole
      setRoles([resolved])
      setRoleModeState(resolved)
    })().finally(()=>{profileRequestRef.current=null})

    profileRequestRef.current=request
    return request
  },[supabase])

  useEffect(()=>{
    let alive=true
    const refreshAuth=async()=>{
      const {data:{session:currentSession}}=await supabase.auth.getSession()
      if(!alive)return
      const currentUser=currentSession?.user??null
      userRef.current=currentUser
      setUser(currentUser);setSession(currentSession)
      if(currentUser)await loadProfile(currentUser.id,true)
      else{setProfile(null);setRoles([]);setRoleModeState(null);setIsOwner(false);await clearOfflineIdentity().catch(()=>{})}
      if(alive)setLoading(false)
    }
    void refreshAuth()

    const timer=window.setInterval(()=>{
      const currentUser=userRef.current
      if(currentUser&&document.visibilityState==="visible")void loadProfile(currentUser.id)
    },30000)
    const focus=()=>{
      const currentUser=userRef.current
      if(currentUser)void loadProfile(currentUser.id)
    }
    window.addEventListener("focus",focus)

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,currentSession)=>{
      const nextUser=currentSession?.user??null
      const previousId=userRef.current?.id??null
      userRef.current=nextUser
      setSession(currentSession);setUser(nextUser)
      if(nextUser){
        if(nextUser.id!==previousId||event==="SIGNED_IN")setTimeout(()=>void loadProfile(nextUser.id,true),0)
      }else{
        setProfile(null);setRoles([]);setRoleModeState(null);setIsOwner(false);void clearOfflineIdentity().catch(()=>{})
      }
    })

    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener("focus",focus);subscription.unsubscribe()}
  },[loadProfile,supabase])

  const realIsAdmin = profile?.role === "admin" || isOwner
  const effectiveRoles:UiRole[]=roles
  const effectiveIsAdmin=effectiveRoles.includes("admin")

  const setRoleMode=async(role:UiRole)=>{
    if(!realIsAdmin)return
    const dbRole=role==="employee"?"staff":role
    const {data,error}=await supabase.rpc("upt_set_admin_role_mode",{p_role:dbRole})
    if(error||data!==dbRole)throw new Error("Rolmodus kon niet worden gewijzigd.")
    await loadProfile(user!.id,true)
  }

  return <AuthContext.Provider value={{user,session,profile,roles:effectiveRoles,isAdmin:effectiveIsAdmin,realIsAdmin:Boolean(realIsAdmin),isOwner,roleMode,setRoleMode,loading,refreshProfile:async()=>{if(user)await loadProfile(user.id,true)}}}>{children}</AuthContext.Provider>
}

export function useAuth(){return useContext(AuthContext)}
export function useDisplayName():string{const{profile,user}=useAuth();if(profile?.full_name)return profile.full_name;if(user?.email)return user.email.split("@")[0];return "Personeel"}
