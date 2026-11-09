"use client"

import {usePathname} from "next/navigation"
import {FloatingChatButton} from "@/components/layout/floating-chat-button"

/** Promotion uses the same draggable chat shortcut as the other portals.
 * Hide it within the conversation itself to avoid duplicating chat controls.
 */
export function PromotionFloatingChatButton(){
 const pathname=usePathname()
 if(pathname==="/portals/promotion/chats"||pathname.startsWith("/portals/promotion/chats/"))return null
 return <FloatingChatButton href="/portals/promotion/chats"/>
}
