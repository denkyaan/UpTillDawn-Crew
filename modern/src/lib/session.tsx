import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react"
import {supabase} from "./supabase"
import {purgeSnapshotUser} from "./local-cache"
import {isActive,parseIdentity,visiblePortals,type Assignment,type Portal,type VerifiedIdentity} from "../shared/identity"

type State={status:"checking"|"anonymous"|"ready"|"denied"|"error";identity:VerifiedIdentity|null;portals:Portal[]}
type SessionApi=State&{refresh:()=>Promise<void>;signIn:(email:string,password:string)=>Promise<void>;signOut:()=>Promise<void>}
const Context=createContext<SessionApi|null>(null)
export function SessionProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<State>({status:"checking",identity:null,portals:[]})
 const db=useMemo(()=>supabase(),[])
 const refresh=useCallback(async()=>{
  const {data:{session},error:sessionError}=await db.auth.getSession()
  if(sessionError){setState({status:"error",identity:null,portals:[]});return}
  if(!session){setState({status:"anonymous",identity:null,portals:[]});return}
  // A stored session is NOT an authorization decision. This invoker RPC
  // verifies signed PostgREST JWT + live approval, owner and effective role.
  const {data,error}=await db.rpc("upt_current_session_context")
  if(error){setState({status:"error",identity:null,portals:[]});return}
  const identity=parseIdentity(Array.isArray(data)?data[0]:null)
  if(!identity||identity.id!==session.user.id||!isActive(identity)){
   setState({status:"denied",identity:null,portals:[]});return
  }
  const assignments=identity.role==="admin"||identity.is_owner?
   {data:[] as Assignment[],error:null}:await db.rpc("upt_my_portal_assignments")
  if(assignments.error){setState({status:"error",identity:null,portals:[]});return}
  setState({status:"ready",identity,portals:visiblePortals(identity,(assignments.data||[]) as Assignment[])})
 },[db])
 useEffect(()=>{
  let mounted=true
  void refresh()
  const {data:{subscription}}=db.auth.onAuthStateChange(()=>{
   // Avoid nested calls into Supabase inside its internal auth lock.
   queueMicrotask(()=>{if(mounted)void refresh()})
  })
  return()=>{mounted=false;subscription.unsubscribe()}
 },[db,refresh])
 const signIn=useCallback(async(email:string,password:string)=>{
  const {error}=await db.auth.signInWithPassword({email,password})
  if(error)throw new Error("login_failed")
  await refresh()
 },[db,refresh])
 const signOut=useCallback(async()=>{
  const uid=state.identity?.id
  await db.auth.signOut()
  if(uid)await purgeSnapshotUser(uid).catch(()=>{})
  setState({status:"anonymous",identity:null,portals:[]})
 },[db,state.identity?.id])
 return <Context.Provider value={{...state,refresh,signIn,signOut}}>{children}</Context.Provider>
}
export function useSession(){const value=useContext(Context);if(!value)throw new Error("SessionProvider missing");return value}
