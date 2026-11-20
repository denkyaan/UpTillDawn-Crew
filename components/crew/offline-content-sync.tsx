'use client'

import {useEffect} from 'react'
import {saveOfflineBriefings,saveOfflineTasks,type OfflineBriefing,type OfflineTask} from '@/lib/crew-offline-snapshot'

export function OfflineBriefingSync({userId,items}:{userId:string;items:OfflineBriefing[]}){
 useEffect(()=>{void saveOfflineBriefings(userId,items).catch(()=>{})},[userId,items])
 return null
}

export function OfflineTaskSync({userId,items}:{userId:string;items:OfflineTask[]}){
 useEffect(()=>{void saveOfflineTasks(userId,items).catch(()=>{})},[userId,items])
 return null
}
