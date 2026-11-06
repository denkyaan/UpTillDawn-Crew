import AdministrationPromotionTasks from "@/app/(app)/portals/administration/promotion-tasks/page"

export const dynamic="force-dynamic"

export default function AdminPromotionTasks({searchParams}:{searchParams:Promise<{q?:string;page?:string;scope?:string}>}){
 return <AdministrationPromotionTasks searchParams={searchParams} adminView/>
}
