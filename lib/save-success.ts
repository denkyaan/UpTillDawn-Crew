import 'server-only'

import { revalidatePath as nextRevalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

const SAVE_SUCCESS_COOKIE='upt-save-success'
export type SaveSuccessKey='saved'|'event_archived'|'event_restored'|'event_closed'|'event_duplicated'

export async function markSaveSuccess(key:SaveSuccessKey='saved'){
  const store=await cookies()
  store.set(SAVE_SUCCESS_COOKIE,encodeURIComponent(key),{
    path:'/',
    sameSite:'lax',
    secure:true,
    maxAge:60,
  })
}

export async function revalidatePath(path:string,type?:'layout'|'page'){
  if(type)nextRevalidatePath(path,type)
  else nextRevalidatePath(path)
  await markSaveSuccess()
}
