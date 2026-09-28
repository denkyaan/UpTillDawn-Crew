'use server'

import { revalidatePath as nextRevalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export const SAVE_SUCCESS_COOKIE='upt-save-success'

export async function revalidatePath(
  path:string,
  type?:'layout'|'page',
){
  if(type)nextRevalidatePath(path,type)
  else nextRevalidatePath(path)

  const store=await cookies()
  store.set(SAVE_SUCCESS_COOKIE,'1',{
    path:'/',
    sameSite:'lax',
    secure:true,
    maxAge:60,
  })
}
