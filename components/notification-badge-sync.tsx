"use client"

import { useEffect } from "react"
import { syncAppBadgeCount } from "@/lib/push-client"

export function NotificationBadgeSync({count}:{count:number}){
  useEffect(()=>{
    void syncAppBadgeCount(Math.max(0,count))
  },[count])
  return null
}
