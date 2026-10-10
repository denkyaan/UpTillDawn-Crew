import {TourHelpIndex} from "@/components/training/tour-help-index"

export default async function HelpPage({searchParams}:{searchParams?:Promise<{tour?:string}>}){
 const params=searchParams?await searchParams:{}
 return <TourHelpIndex training={params.tour==="1"}/>
}
