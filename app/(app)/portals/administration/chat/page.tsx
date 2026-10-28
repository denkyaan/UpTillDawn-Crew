import ChatPage from "@/app/(app)/chat/page"
export const dynamic="force-dynamic"
export default async function AdministrationChat({searchParams}:{searchParams?:Promise<{channel?:string;message?:string}>}){
 const params=searchParams?await searchParams:{}
 return <ChatPage searchParams={Promise.resolve({...params,administration:"1"})}/>
}
