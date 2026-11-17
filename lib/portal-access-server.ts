import {cache} from 'react'
import {createClient} from '@/lib/supabase/crew-server'

/**
 * One RLS-authorized assignment lookup per React server request.
 * Authenticated route layouts, switcher and the page guard can execute in
 * parallel. Do not create a process-global cache or cache across users.
 *
 * This caches ONLY the read result. All authorization decisions still
 * re-check current approval/block status and enforce database RLS.
 */
export const currentPortalAssignments=cache(async()=>{
 const supabase=await createClient()
 return supabase.rpc('upt_my_portal_assignments')
})
