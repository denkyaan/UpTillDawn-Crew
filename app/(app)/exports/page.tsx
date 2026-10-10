import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { SandboxSystemTraining } from '@/components/training/sandbox-system-training'

export default async function Page({searchParams}:{searchParams?:Promise<{tour?:string}>}){
 const params=searchParams?await searchParams:{}
 if(!(await getCurrentUser())?.isAdmin) redirect('/')
 if(params.tour==='1')return <SandboxSystemTraining role="admin" module="exports"/>
 return <main className="p-6"><h1 className="text-3xl font-bold">Excel</h1><p className="my-4 text-muted-foreground">Urenexport alleen voor beheerders.</p><a className="inline-block rounded-xl border px-4 py-3" href="/api/uptilldawn/export">XLSX downloaden</a></main>
}
