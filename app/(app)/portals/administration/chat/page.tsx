import ChatPage from "@/app/(app)/chat/page"
export const dynamic="force-dynamic"
export default function AdministrationChat(){
 return <ChatPage searchParams={Promise.resolve({administration:"1"})}/>
}
