'use client'

import {useEffect} from 'react'
import {usePathname} from 'next/navigation'
import {useAuth} from '@/lib/providers'

export const LAST_WORKSPACE_COOKIE='uptilldawn-last-workspace'
export type Workspace='god-mode'|'administration'|'promotion'|'admin'|'events'

function workspaceFromPath(path:string,isOwner:boolean):Workspace|null{
 if(path==='/god-mode'||path.startsWith('/god-mode/'))return isOwner?'god-mode':null
 if(path==='/maker-mode'||path.startsWith('/maker-mode/'))return null
 if(path==='/portals/administration'||path.startsWith('/portals/administration/'))return 'administration'
 if(path==='/portals/promotion'||path.startsWith('/portals/promotion/'))return 'promotion'
 if(path==='/portals'||path.startsWith('/portals/'))return null
 if(path==='/admin'||path.startsWith('/admin/'))return 'admin'
 if(path==='/'||['/events','/workplaces','/operations','/chat','/tasks','/inventory','/sales','/guestlist'].some(route=>path===route||path.startsWith(route+'/')))return 'events'
 return null
}

/** Only a workspace hint is persisted. There is no secret in this cookie,
 * and server-side launch validates both account identity and portal access. */
export function WorkspaceContinuity(){
 const pathname=usePathname()
 const {user,isOwner,loading}=useAuth()
 const userId=user?.id
 useEffect(()=>{
  if(loading||!userId||!pathname)return
  const workspace=workspaceFromPath(pathname,isOwner)
  if(!workspace)return
  const value=encodeURIComponent(userId+':'+workspace)
  const secure=window.location.protocol==='https:'?'; Secure':''
  document.cookie=`${LAST_WORKSPACE_COOKIE}=${value}; Path=/; Max-Age=7776000; SameSite=Lax${secure}`
 },[pathname,userId,isOwner,loading])
 return null
}
