"use client"
import dynamic from "next/dynamic"
import type {ComponentProps} from "react"
import type {StaffEventsClient as View} from "@/components/crew/staff-events-client"
type Props=ComponentProps<typeof View>
const Client=dynamic<Props>(()=>import("@/components/crew/staff-events-client").then(m=>m.StaffEventsClient),{ssr:false,loading:()=>null})
export function LazyStaffEvents(props:Props){return <Client {...props}/>}
