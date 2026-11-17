"use client"

// The complete chat workspace is interactive and already fetches fresh,
 // authenticated data after mount. Do not render its heavy 65KB interactive
// tree in the memory-limited Cloudflare Free SSR isolate on every navigation.
// The server page still verifies identity and every initial RLS read; the
// browser still receives exactly the same ChatClient props and functionality.
import dynamic from "next/dynamic"
import type {ComponentProps} from "react"
import type {ChatClient as ChatClientComponent} from "@/components/crew/chat-client"

type ChatProps=ComponentProps<typeof ChatClientComponent>
const ClientChat=dynamic<ChatProps>(
 ()=>import("@/components/crew/chat-client").then(module=>module.ChatClient),
 {ssr:false,loading:()=><div role="status" className="p-4 text-sm text-muted-foreground">Gesprekken laden…</div>},
)
export function LazyChatClient(props:ChatProps){
 return <ClientChat {...props}/>
}
