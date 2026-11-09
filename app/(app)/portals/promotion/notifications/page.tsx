import NotificationsPage from "@/app/(app)/notifications/page"

export const dynamic = "force-dynamic"

export default async function PromotionNotifications({searchParams}:{searchParams:Promise<{page?:string;view?:string}>}) {
  const {page,view}=await searchParams
  return <NotificationsPage searchParams={Promise.resolve({page,view,scope:'promotion'})}/>
}
