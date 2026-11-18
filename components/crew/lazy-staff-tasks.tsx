"use client"
import dynamic from "next/dynamic"
import type {ComponentProps} from "react"
import type {StaffTasksClient as View} from "@/components/crew/staff-tasks-client"
type Props=ComponentProps<typeof View>
const Client=dynamic<Props>(()=>import("@/components/crew/staff-tasks-client").then(m=>m.StaffTasksClient),{ssr:false,loading:()=> <main className="space-y-4 p-4 md:p-8" aria-busy="true"><h1 className="text-3xl font-black">Taken</h1><p className="text-sm text-muted-foreground" role="status">Taken worden geladen…</p></main>})
export function LazyStaffTasks(props:Props){return <Client {...props}/>}
