import AdministrationAccessNotice from '@/components/administration/portal-access-notice'
import TasksPage from '@/app/(app)/tasks/page'
import {administrationPageAccess} from '@/lib/administration/page-access'
import {requestUiLocale} from '@/lib/server-locale'
import {translateRuntimeUi} from '@/lib/ui-translation-runtime'
import {nlStatus} from '@/lib/ui-nl'

export const dynamic = "force-dynamic"

export default async function Page({searchParams}:{searchParams:Promise<{event?:string;workplace?:string;user?:string}>}){
 const access=await administrationPageAccess()
 if(!access.ok)return <AdministrationAccessNotice status={access.status}/>
 if(access.user.role==='admin')return TasksPage({searchParams})
 const locale=await requestUiLocale()
 const {data,error}=await access.db.from('task_assignments').select('id,status,tasks(id,title,description)').eq('user_id',access.user.id).order('created_at',{ascending:false}).limit(100)
 return <main className="mx-auto max-w-5xl space-y-4 p-5"><h1 className="text-2xl font-bold">{translateRuntimeUi('Taken',locale)}</h1><p className="text-sm text-muted-foreground">{translateRuntimeUi('Alleen-lezen',locale)}</p>
  {error?<p role="alert">{translateRuntimeUi('Gegevens konden niet worden geladen.',locale)}</p>:!data?.length?<p>{translateRuntimeUi('Geen taken gevonden.',locale)}</p>:data.map(row=><article key={row.id} className="rounded-xl border p-4"><h2 className="font-semibold">{row.tasks?.title}</h2><p>{row.tasks?.description}</p><p>{translateRuntimeUi(nlStatus(row.status),locale)}</p></article>)}
 </main>
}
