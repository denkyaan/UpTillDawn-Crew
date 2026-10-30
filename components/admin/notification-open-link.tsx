"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import { useAdminSelection, type AdminSelection } from "@/lib/admin-selection-context"
import { useAuth } from "@/lib/providers"
import { usePathname } from "next/navigation"
import { administrationNotificationHref } from "@/lib/administration/navigation"

function selectionFromHref(href:string):Partial<AdminSelection>{
  try{
    const url=new URL(href,"https://uptilldawn.local")
    const eventFromPath=url.pathname.match(/^\/events\/([0-9a-f-]{36})\/command$/i)?.[1]||null
    return {
      eventId:url.searchParams.get("event")||eventFromPath,
      workplaceId:url.searchParams.get("workplace"),
      userId:url.searchParams.get("user"),
      shiftId:url.searchParams.get("shift"),
      focus:url.searchParams.get("focus"),
    }
  }catch{
    return {}
  }
}

export function NotificationOpenLink({
  href,
  children,
  ...props
}:Omit<ComponentProps<typeof Link>,"href"> & {href:string}){
  const admin=useAdminSelection()
  const {isAdmin}=useAuth()
  const pathname=usePathname()
  const target=pathname.startsWith("/portals/administration/")?administrationNotificationHref(href):href
  if(!target)return null
  return <Link
    {...props}
    href={target}
    onClick={event=>{
      if(isAdmin){
        const context=selectionFromHref(target)
        if(Object.values(context).some(Boolean))admin.setSelection(context)
      }
      props.onClick?.(event)
    }}
  >{children}</Link>
}
