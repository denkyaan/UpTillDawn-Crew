import {createBrowserClient} from "@supabase/ssr"
import type {SupabaseClient} from "@supabase/supabase-js"

let browser:SupabaseClient|null=null
export function supabase():SupabaseClient{
 if(browser)return browser
 const url=import.meta.env.VITE_SUPABASE_URL
 const key=import.meta.env.VITE_SUPABASE_ANON_KEY
 if(!url||!key)throw new Error("Missing public Supabase configuration")
 // Uses @supabase/ssr cookie semantics for compatibility with the existing
 // authenticated PWA. Database access remains guarded by RLS, never a key
 // extracted from local user input or a service-role credential.
 browser=createBrowserClient(url,key,{auth:{flowType:"pkce"}})
 return browser
}
