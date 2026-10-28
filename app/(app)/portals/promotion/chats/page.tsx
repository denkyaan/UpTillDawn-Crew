import ChatPage from "@/app/(app)/chat/page"

export const dynamic = "force-dynamic"

export default function PromotionChats({searchParams}:{searchParams?:Promise<{event?:string;workplace?:string;private?:string;channel?:string;message?:string}>}) {
  return <ChatPage searchParams={searchParams}/>
}
