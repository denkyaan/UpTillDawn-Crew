import {useEffect,useState,type ReactNode} from 'react'
import {Navigate} from 'react-router-dom'
import {createClient} from '../compat/crew-client'
import Loading from 'main-source/app/(app)/loading.tsx'

// The original incidents source page redirects a non-admin to /events when
// there is no active event, or when neither an active shift nor current work
// context authorizes access. Keep exactly the same predicates at the router
// boundary: asynchronous source-page redirects may never commit while its
// parent AppLayout is suspended. No role comes from browser storage/claims.
export function incidentDestination(
 isAdmin:boolean,
 activeEventIds:readonly string[],
 shiftEventIds:readonly string[],
 hasCurrentWorkContext:boolean,
):'/events'|null{
 if(isAdmin)return null
 if(activeEventIds.length===0)return '/events'
 const active=new Set(activeEventIds)
 const hasActiveShift=shiftEventIds.some(eventId=>active.has(eventId))
 return !hasActiveShift&&!hasCurrentWorkContext?'/events':null
}

type State='checking'|'allow'|'redirect'
export function IncidentAccessRedirect({userId,isAdmin,children,loading}:{
 userId:string;isAdmin:boolean;children:ReactNode;loading:ReactNode
}){
 const [state,setState]=useState<State>(isAdmin?'allow':'checking')
 useEffect(()=>{
  if(isAdmin){setState('allow');return}
  let alive=true
  setState('checking')
  const now=new Date().toISOString(),db=createClient()
  // Identical authenticated Supabase queries and filters to the original
  // app/(app)/incidents/page.tsx. The database enforces RLS on all three.
  void Promise.all([
   db.from('events').select('id').lte('start_at',now).gte('end_at',now).neq('status','archived'),
   db.from('shifts').select('event_id').eq('user_id',userId)
    .neq('status','cancelled').neq('response_status','declined')
    .lte('scheduled_start',now).gte('scheduled_end',now),
   db.rpc('upt_current_work_context'),
  ]).then(([events,shifts,context])=>{
   if(!alive)return
   // Unknown or denied database reads are NOT evidence of no shift.
   // Delegate error UI to the unmodified original page, never redirect
   // from missing, untrusted or failed authorization data.
   if(events.error||shifts.error||context.error){setState('allow');return}
   const eventIds=(events.data??[]).map(e=>e.id)
   const activeEvents=new Set(eventIds)
   const activeShifts=(shifts.data??[]).map(s=>s.event_id)
    .filter((eventId):eventId is string=>typeof eventId==='string'&&activeEvents.has(eventId))
   const currentContext=Array.isArray(context.data)?context.data[0]:null
   const destination=incidentDestination(false,eventIds,activeShifts,Boolean(currentContext))
   setState(destination?'redirect':'allow')
  }).catch(()=>{if(alive)setState('allow')})
  return ()=>{alive=false}
 },[userId,isAdmin])
 if(state==='redirect')return <Navigate to="/events" replace/>
 if(state==='checking')return <>{loading}</>
 return <>{children}</>
}
