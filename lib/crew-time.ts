export type TimeSession={id:string;user_id:string;event_id:string;started_at:string;ended_at:string|null;workplace_id:string|null}
export type TimeBreak={work_session_id:string;started_at:string;ended_at:string|null}
export type Transition={work_session_id:string;to_workplace_id:string;confirmed_at:string}
export type TimeSegment={sessionId:string;userId:string;eventId:string;workplaceId:string|null;start:number;end:number;grossSeconds:number;regularBreakSeconds:number;excessBreakSeconds:number;netSeconds:number}
export function allocateTime(sessions:TimeSession[],breaks:TimeBreak[],transitions:Transition[],now:number):TimeSegment[]{
 if(!Number.isFinite(now)||now<0)throw new Error('Invalid allocation clock')
 const rows:TimeSegment[]=[];const allowance=new Map<string,number>(),previousEnd=new Map<string,number>()
 const sessionIds=new Set<string>()
 const sessionBounds=new Map<string,{start:number;end:number}>()
 for(const session of sessions){
  if(!session.id?.trim()||!session.user_id?.trim()||!session.event_id?.trim()||sessionIds.has(session.id))throw new Error('Invalid or duplicate work session identity')
  sessionIds.add(session.id)
  const start=Date.parse(session.started_at),end=session.ended_at?Date.parse(session.ended_at):now
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw new Error('Invalid work interval')
  sessionBounds.set(session.id,{start,end})
 }
 for(const entry of breaks){
  const begin=Date.parse(entry.started_at),finish=entry.ended_at?Date.parse(entry.ended_at):now
  const bounds=sessionBounds.get(entry.work_session_id)
  if(!bounds||!Number.isFinite(begin)||!Number.isFinite(finish)||finish<=begin||begin<bounds.start||finish>bounds.end)throw new Error('Invalid break interval')
 }
 const transitionTimes=new Set<string>()
 for(const entry of transitions){
  const bounds=sessionBounds.get(entry.work_session_id),at=Date.parse(entry.confirmed_at)
  if(!bounds||!entry.to_workplace_id?.trim()||!Number.isFinite(at)||at<bounds.start||at>=bounds.end)throw new Error('Invalid workplace transition')
  const transitionKey=JSON.stringify([entry.work_session_id,at])
  if(transitionTimes.has(transitionKey))throw new Error('Conflicting workplace transitions at the same instant')
  transitionTimes.add(transitionKey)
 }
 for(const s of [...sessions].sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)||a.id.localeCompare(b.id))){
 const start=Date.parse(s.started_at),end=s.ended_at?Date.parse(s.ended_at):now,key=`${s.user_id}:${s.event_id}`
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw new Error('Invalid work interval')
 if((previousEnd.get(s.user_id)||0)>start)throw new Error('Overlapping work sessions require correction')
 previousEnd.set(s.user_id,end)
 let available=allowance.get(key)??3600,workplace=s.workplace_id
 const ranges=breaks.filter(b=>b.work_session_id===s.id).map(b=>[Math.max(start,Date.parse(b.started_at)),Math.min(end,b.ended_at?Date.parse(b.ended_at):now)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0])
 const merged:number[][]=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range])}
 const changes=transitions.filter(t=>t.work_session_id===s.id).map(t=>({at:Date.parse(t.confirmed_at),workplace:t.to_workplace_id})).filter(t=>t.at>=start&&t.at<end).sort((a,b)=>a.at-b.at)
 let cursor=start
 for(const point of [...changes,{at:end,workplace:null}]){
 if(point.at>cursor){const duration=(point.at-cursor)/1000;const pause=merged.reduce((n,[a,b])=>n+Math.max(0,Math.min(b,point.at)-Math.max(a,cursor))/1000,0);const regular=Math.min(available,pause);available-=regular;const excess=pause-regular
 rows.push({sessionId:s.id,userId:s.user_id,eventId:s.event_id,workplaceId:workplace,start:cursor,end:point.at,grossSeconds:duration,regularBreakSeconds:regular,excessBreakSeconds:excess,netSeconds:Math.max(0,duration-excess)})}
 cursor=point.at;workplace=point.workplace
 }
 allowance.set(key,available)
 }
 return rows
}
