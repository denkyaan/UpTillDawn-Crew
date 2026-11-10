// Create the Maker-only QA identity for the disposable local Supabase stack.
// The existing 15 bot fixtures supply the other five portal roles.
// Never grant maker/owner rights to the normal Admin bot: doing so would
// change its login redirect and invalidate its ordinary Admin acceptance.
import {createClient} from '@supabase/supabase-js'

const url=process.env.BOT_SUPABASE_URL
const key=process.env.BOT_SERVICE_ROLE_KEY
const password=process.env.BOT_TEST_PASSWORD
if(!url||!key||!password)throw Error('Missing isolated browser-test environment')
const target=new URL(url)
if(target.protocol!=='http:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='54321')
 throw Error('Maker QA identity can only be created on local Supabase port 54321')

const email='bot-16-maker@bots.uptilldawn.test'
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'E2E MAKER 16'}})
if(error||!data.user)throw Error('Unable to create isolated Maker QA identity: '+(error?.message||'no user'))
const {error:profileError}=await db.from('profiles').upsert({
 id:data.user.id,full_name:'E2E MAKER 16',approved:true,role:'staff',
 account_blocked:false,updated_at:new Date().toISOString(),
},{onConflict:'id'})
if(profileError)throw Error('Unable to create Maker QA profile: '+profileError.message)
// Owner privilege is deliberately granted in CI using privileged SQL against
// the disposable local database, never through client-facing APIs.
console.log('PASS: distinct isolated Maker QA identity created (owner grant pending)')
