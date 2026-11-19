import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from "react"
import {supabase} from "./supabase"
import {purgeSnapshotUser} from "./local-cache"
import {createRefreshGate} from "../shared/refresh-gate"

// Keep chat/offline text out of the initial authenticated JavaScript bundle.
// Dynamic import runs only on logout, denial or identity switch.
async function purgeLocalUser(uid:string){
 await Promise.all([
  purgeSnapshotUser(uid),
  import("./chat-outbox").then(m=>m.purgeOutboxUser(uid)),
 ])
}
import {isActive,parseIdentity,visiblePortals,type Assignment,type Portal,type VerifiedIdentity} from "../shared/identity"

type State={status:"checking"|"anonymous"|"ready"|"denied"|"error";identity:VerifiedIdentity|null;portals:Portal[]}
type SessionApi=State&{refresh:()=>Promise<void>;signIn:(email:string,password:string)=>Promise<void>;signOut:()=>Promise<void>}
const Context=createContext<SessionApi|null>(null)
export function SessionProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<State>({status:"checking",identity:null,portals:[]})
 const db=useMemo(()=>supabase(),[])
 const lastIdentity=useRef<string|null>(null)
 const refreshGate=useRef(createRefreshGate())
 const refresh=useCallback(()=>refreshGate.current.validate(async ticket=>{
  if(!refreshGate.current.isCurrent(ticket))return
  // Fail closed while confirming fresh permissions. Never keep stale admin
  // data visible through a session revalidation or browser tab resume.
  setState({status:"checking",identity:null,portals:[]})
  let result:Awaited<ReturnType<typeof db.auth.getSession>>
  try{result=await db.auth.getSession()}
  catch{if(refreshGate.current.isCurrent(ticket))setState({status:"error",identity:null,portals:[]});return}
  const {data:{session},error:sessionError}=result
  if(!refreshGate.current.isCurrent(ticket))return
  if(sessionError){setState({status:"error",identity:null,portals:[]});return}
  if(!session){
   if(lastIdentity.current)void purgeLocalUser(lastIdentity.current).catch(()=>{})
   lastIdentity.current=null
   setState({status:"anonymous",identity:null,portals:[]});return
  }
  // A stored session is NOT an authorization decision. This invoker RPC
  // verifies signed PostgREST JWT + live approval, owner and effective role.
  const {data,error}=await db.rpc("upt_current_session_context")
  if(!refreshGate.current.isCurrent(ticket))return
  if(error){setState({status:"error",identity:null,portals:[]});return}
  const identity=parseIdentity(Array.isArray(data)?data[0]:null)
  if(!identity||identity.id!==session.user.id||!isActive(identity)){
   void purgeLocalUser(session.user.id).catch(()=>{})
   lastIdentity.current=null
   setState({status:"denied",identity:null,portals:[]});return
  }
  const assignments=identity.role==="admin"||identity.is_owner?
   {data:[] as Assignment[],error:null}:await db.rpc("upt_my_portal_assignments")
  if(!refreshGate.current.isCurrent(ticket))return
  if(assignments.error){setState({status:"error",identity:null,portals:[]});return}
  if(lastIdentity.current&&lastIdentity.current!==identity.id)
   void purgeLocalUser(lastIdentity.current).catch(()=>{})
  lastIdentity.current=identity.id
  setState({status:"ready",identity,portals:visiblePortals(identity,(assignments.data||[]) as Assignment[])})
 }),[db])
 useEffect(()=>{
  let mounted=true
  void refresh()
  const visible=()=>{if(document.visibilityState==="visible")void refresh()}
  document.addEventListener("visibilitychange",visible)
  const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{
   // Initial session is already checked by the explicit initial refresh.
   if(event==="INITIAL_SESSION")return
   if(event==="SIGNED_OUT"){
    refreshGate.current.invalidate()
    const uid=lastIdentity.current
    lastIdentity.current=null
    setState({status:"anonymous",identity:null,portals:[]})
    if(uid)void purgeLocalUser(uid).catch(()=>{})
    return
   }
   // A genuinely different sign-in or rotated token must invalidate any
   // request that started under the previous credentials.
   if(event==="TOKEN_REFRESHED"||event==="USER_UPDATED"||
     (event==="SIGNED_IN"&&session?.user.id!==lastIdentity.current))
    refreshGate.current.invalidate()
   // Avoid calling Supabase auth methods synchronously inside its own lock.
   queueMicrotask(()=>{if(mounted)void refresh()})
  })
  return()=>{mounted=false;refreshGate.current.invalidate();document.removeEventListener("visibilitychange",visible);subscription.unsubscribe()}
 },[db,refresh])
 const signIn=useCallback(async(email:string,password:string)=>{
  const {error}=await db.auth.signInWithPassword({email,password})
  if(error)throw new Error("login_failed")
  await refresh()
 },[db,refresh])
 const signOut=useCallback(async()=>{
  refreshGate.current.invalidate()
  const uid=lastIdentity.current||state.identity?.id
  lastIdentity.current=null
  setState({status:"checking",identity:null,portals:[]})
  const {error}=await db.auth.signOut()
  if(error){
   // Never claim that logout succeeded if the auth provider rejected it.
   setState({status:"error",identity:null,portals:[]})
   throw new Error("signout_failed")
  }
  if(uid)await purgeLocalUser(uid).catch(()=>{})
  setState({status:"anonymous",identity:null,portals:[]})
 },[db,state.identity?.id])
 return <Context.Provider value={{...state,refresh,signIn,signOut}}>{children}</Context.Provider>
}
export function useSession(){const value=useContext(Context);if(!value)throw new Error("SessionProvider missing");return value}
