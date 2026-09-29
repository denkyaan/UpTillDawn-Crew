"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import { useAdminSelection, type AdminSelection } from "@/lib/admin-selection-context"

export function ContextLink({
  href,
  context,
  children,
  ...props
}:Omit<ComponentProps<typeof Link>,"href"> & {href:string;context?:Partial<AdminSelection>}){
  const admin=useAdminSelection()
  const nextHref=admin.href(href,context||{})
  return <Link {...props} href={nextHref} onClick={event=>{
    if(context)admin.setSelection(context)
    props.onClick?.(event)
  }}>{children}</Link>
}
