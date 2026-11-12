// Internal QA-only bot provisioning. NOT a user-facing feature.
// Use Supabase Auth Admin API: never write auth.users/auth.identities by SQL.
// Run only against the isolated Main-test project with its own service key.
// Required: UPT_QA_ALLOW_MAIN_SEED=1 BOT_SUPABASE_URL BOT_SERVICE_ROLE_KEY BOT_TEST_PASSWORD.
// --plan prints non-sensitive role inventory without any network requests.
import {createClient} from '@supabase/supabase-js'

export const QA_MAIN_HOST='npbjrtiolqperdgljnhi.supabase.co'
export const QA_SEVEN=[
 {key:'head_admin',email:'e2e-head-admin@uptilldawn.test',name:'E2E Hoofdadmin',role:'admin'},
 {key:'left_hand',email:'e2e-admin@uptilldawn.test',name:'E2E Linkerhand',role:'staff',leadership:'left_hand'},
 {key:'right_hand',email:'e2e-right-hand@uptilldawn.test',name:'E2E Rechterhand',role:'staff',leadership:'right_hand'},
 {key:'responsible',email:'e2e-responsible@uptilldawn.test',name:'E2E Verantwoordelijke',role:'responsible_lead'},
 {key:'staff',email:'e2e-staff@uptilldawn.test',name:'E2E Personeel',role:'staff'},
 {key:'promotion',email:'e2e-promotion@uptilldawn.test',name:'E2E Promotie',role:'staff',portal:'promotion',portalRole:'promoter'},
 {key:'administration',email:'e2e-administration@uptilldawn.test',name:'E2E Administratie',role:'staff',portal:'administration',portalRole:'administrative_staff'}
]

if(process.argv.includes('--plan')){
 console.log('PLAN: seven isolated QA roles',JSON.stringify(QA_SEVEN.map(({key,email,role,leadership,portal})=>({key,email,role,leadership,portal}))))
 process.exit(0)
}
if(process.env.UPT_QA_ALLOW_MAIN_SEED!=='1')throw Error('Main-test QA seeding is disabled')
const url=process.env.BOT_SUPABASE_URL
const key=process.env.BOT_SERVICE_ROLE_KEY
const password=process.env.BOT_TEST_PASSWORD
let target
try{target=new URL(url||'')}catch{throw Error('Main-test Supabase URL required')}
if(target.protocol!=='https:'||target.hostname!==QA_MAIN_HOST||target.pathname!=='/'||target.search||target.hash)throw Error('Refusing to provision outside isolated Main-test Supabase project')
if(!key||!password||password.length<16)throw Error('Service role key and 16+ character QA password required via private environment')
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const known=new Map()
for(let page=1;page<=100;page++){
 const {data,error}=await db.auth.admin.listUsers({page,perPage:100})
 if(error)throw Error('Auth admin listUsers failed: '+error.message)
 for(const user of data.users)if(QA_SEVEN.some(bot=>bot.email===user.email?.toLowerCase()))known.set(user.email.toLowerCase(),user)
 if(data.users.length<100)break
 if(page===100)throw Error('Auth account scan exceeded safe page limit')
}
const ids=new Map()
const created=[]
for(const bot of QA_SEVEN){
 let user=known.get(bot.email)
 if(!user){
  const response=await db.auth.admin.createUser({email:bot.email,password,email_confirm:true,user_metadata:{full_name:bot.name,qa_fixture:true}})
  if(response.error||!response.data.user)throw Error('Unable to create '+bot.key+': '+(response.error?.message||'no user'))
  user=response.data.user
  created.push(bot.key)
 }
 const {data:previous,error:previousError}=await db.from('profiles').select('id,role').eq('id',user.id).maybeSingle()
 if(previousError)throw Error('Unable to validate '+bot.key+' profile')
 // Only the exact QA email identities above may be changed. Never convert
 // another person's role or attach Owner privileges.
 if(previous&&previous.role!==bot.role&&created.indexOf(bot.key)===-1)throw Error('Existing '+bot.key+' has unexpected role: abort')
 const {error:profileError}=await db.from('profiles').upsert({
  id:user.id,full_name:bot.name,role:bot.role,approved:true,account_blocked:false,updated_at:new Date().toISOString()
 },{onConflict:'id'})
 if(profileError)throw Error('Unable to prepare QA profile '+bot.key+': '+profileError.message)
 ids.set(bot.key,user.id)
}
for(const bot of QA_SEVEN.filter(x=>x.leadership)){
 const user_id=ids.get(bot.key)
 const {data:existing,error}=await db.from('upt_organization_leadership').select('user_id').eq('slot',bot.leadership).maybeSingle()
 if(error)throw Error('Leadership read failed for '+bot.key)
 if(existing&&existing.user_id!==user_id)throw Error('A different account owns '+bot.leadership+'; refusing to overwrite')
 if(!existing){
  const {error:assignError}=await db.from('upt_organization_leadership').insert({
   slot:bot.leadership,user_id,assigned_by:ids.get('head_admin'),managed_portal_grant:false
  })
  if(assignError)throw Error('Leadership assignment failed for '+bot.key+': '+assignError.message)
 }
}
for(const bot of QA_SEVEN.filter(x=>x.portal)){
 const user_id=ids.get(bot.key)
 const {data:rows,error}=await db.from('portal_role_assignments').select('id,approved,revoked_at').eq('user_id',user_id).eq('portal',bot.portal).eq('role',bot.portalRole)
 if(error)throw Error('Portal role lookup failed: '+bot.key)
 if(!rows?.some(row=>row.approved&&!row.revoked_at)){
  if(rows?.length)throw Error('Existing revoked/pending portal role for '+bot.key+': require human reconciliation')
  const {error:e}=await db.from('portal_role_assignments').insert({
   user_id,portal:bot.portal,role:bot.portalRole,approved:true,
   approved_by:ids.get('head_admin'),approved_at:new Date().toISOString()
  })
  if(e)throw Error('Portal QA assignment failed for '+bot.key+': '+e.message)
 }
}
if(ids.size!==7||new Set(ids.values()).size!==7)throw Error('Seven distinct QA identities were not established')
for(const bot of QA_SEVEN){
 const id=ids.get(bot.key)
 const {data:p,error}=await db.from('profiles').select('role,approved,account_blocked').eq('id',id).single()
 if(error||p?.role!==bot.role||!p?.approved||p?.account_blocked)throw Error('Final profile verification failed: '+bot.key)
}
console.log('PASS: seven distinct isolated Main-test role bots provisioned/verified; '+created.length+' new, '+(7-created.length)+' reused. Passwords were not logged.')
