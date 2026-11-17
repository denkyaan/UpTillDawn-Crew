"use client"
import dynamic from "next/dynamic"
import type {ComponentProps} from "react"
import type {StaffTasksClient as View} from "@/components/crew/staff-tasks-client"
type Props=ComponentProps<typeof View>
const Client=dynamic<Props>(()=>import("@/components/crew/staff-tasks-client").then(m=>m.StaffTasksClient),{ssr:false,loading:()=>null})
export function LazyStaffTasks(props:Props){return <Client {...props}/>}
