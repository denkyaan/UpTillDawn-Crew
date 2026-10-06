import {readFile,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'

const repo=process.env.GITHUB_REPOSITORY||'denkyaan/UpTillDawn-Crew'
const reportId=process.env.REPORT_ID||''
const route=process.env.ERROR_ROUTE||'/'
const errorName=process.env.ERROR_NAME||'Error'
const errorMessage=process.env.ERROR_MESSAGE||''
const stackTrace=process.env.STACK_TRACE||''
const aiSummary=process.env.AI_SUMMARY||''
const maxAttempts=Math.max(1,Math.min(5,Number(process.env.MAX_REPAIR_ATTEMPTS||4)))
let repairFeedback=''
let diagnosis=null
const account=process.env.CF_ACCOUNT_ID||''
const token=process.env.CF_API_TOKEN||''
const model='@cf/meta/llama-3.3-70b-instruct-fp8-fast'

const allowedPrefixes=['app/','components/','lib/','tests/','types/']
const forbidden=['.github/','supabase/migrations/','wrangler','package-lock.json','package.json','.env']
const editable=p=>allowedPrefixes.some(x=>p.startsWith(x))&&!forbidden.some(x=>p.startsWith(x))&&/\.(ts|tsx|mjs|json)$/.test(p)

function sh(cmd,args=[],opts={}){return execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...opts}).trim()}
async function ai(messages,max_tokens=7000){
 if(!account||!token)throw new Error('Cloudflare AI credentials ontbreken.')
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({messages,response_format:{type:'json_object'},max_tokens,temperature:0.05}),
 })
 const data=await r.json()
 if(!r.ok||!data?.success)throw new Error('Workers AI request failed: '+JSON.stringify(data).slice(0,1000))
 const raw=data.result?.response??data.result
 return typeof raw==='string'?JSON.parse(raw):raw
}
async function candidates(){
 const tracked=sh('git',['ls-files']).split('\n').filter(editable)
 const terms=(route+' '+errorName+' '+errorMessage+' '+stackTrace).toLowerCase().split(/[^a-z0-9_/-]+/).filter(x=>x.length>3)
 return tracked.map(path=>({path,score:terms.reduce((n,t)=>n+(path.toLowerCase().includes(t)?3:0),0)}))
  .sort((a,b)=>b.score-a.score).slice(0,50).map(x=>x.path)
}
async function diagnose(){
 const paths=await candidates()
 const selected=await ai([
  {role:'system',content:'Selecteer maximaal 10 bronbestanden die nodig zijn om de gemelde fout te verklaren. Kies alleen uit candidates. Geef uitsluitend JSON {paths:string[]}.'},
  {role:'user',content:JSON.stringify({route,errorName,errorMessage,stackTrace,aiSummary,repairFeedback,candidates:paths})},
 ],1200)
 const chosen=[...new Set(selected.paths||[])].filter(p=>paths.includes(p)).slice(0,10)
 if(!chosen.length)return null
 const files=[]
 let bytes=0
 for(const path of chosen){const content=await readFile(path,'utf8');bytes+=Buffer.byteLength(content);if(bytes<=170000)files.push({path,content})}
 const evidence=await ai([
  {role:'system',content:[
   'Je bent de diagnosepoort van UpTillDawn Crew. Je mag GEEN codewijziging voorstellen.',
   'Bepaal eerst de root cause uit het foutrapport en de meegeleverde broncode.',
   'Geef uitsluitend JSON {rootCause,evidence:[{path,detail}],confidence,affectedPaths}.',
   'confidence is low, medium of high. affectedPaths bevat alleen paden uit files.',
   'Evidence moet concreet verwijzen naar gedrag/code in de meegeleverde bestanden.',
   'Als de oorzaak niet bewezen kan worden: confidence=low en affectedPaths=[].',
  ].join('\\n')},
  {role:'user',content:JSON.stringify({reportId,route,errorName,errorMessage,stackTrace,aiSummary,repairFeedback,files})},
 ],3000)
 const confidence=['low','medium','high'].includes(evidence?.confidence)?evidence.confidence:'low'
 const affected=[...new Set(evidence?.affectedPaths||[])].filter(p=>files.some(file=>file.path===p)&&editable(p)).slice(0,8)
 const proof=Array.isArray(evidence?.evidence)?evidence.evidence.filter(item=>item&&typeof item.path==='string'&&typeof item.detail==='string'&&files.some(file=>file.path===item.path)).slice(0,12):[]
 if(confidence==='low'||!affected.length||!proof.length||typeof evidence?.rootCause!=='string'||!evidence.rootCause.trim())return null
 return {rootCause:evidence.rootCause.trim(),evidence:proof,confidence,affectedPaths:affected,files}
}
async function propose(){
 diagnosis=await diagnose()
 if(!diagnosis)return output(false,'Geen voldoende bewezen root cause; automatische wijziging geweigerd.')
 const files=diagnosis.files.filter(file=>diagnosis.affectedPaths.includes(file.path))
 const result=await ai([
  {role:'system',content:[
   'Je bent de begrensde self-healing programmeur van UpTillDawn Crew.',
   'Maak uitsluitend een minimale fix voor de bewezen root cause uit diagnosis.',
   'Wijzig niets dat niet rechtstreeks door diagnosis.evidence wordt ondersteund.',
   'Geef JSON {summary,confidence,changes:[{path,content}]}. confidence is low, medium of high.',
   'content is steeds de volledige nieuwe bestandsinhoud.',
   'Wijzig uitsluitend bestanden die volledig in files zijn meegegeven.',
   'Geen database-migraties, workflows, secrets, dependencies, auth/RLS-versoepeling of nieuwe externe diensten.',
   'Behoud bestaande functionaliteit. Nieuwe zichtbare tekst vereist NL/FR/EN/DE-dekking.',
   'Gebruik confidence als diagnostische indicatie, niet als publicatiebeslissing. Als je na brononderzoek geen verantwoorde fix kunt formuleren: changes=[].',
  ].join('\n')},
  {role:'user',content:JSON.stringify({reportId,route,errorName,errorMessage,stackTrace,aiSummary,repairFeedback,diagnosis:{rootCause:diagnosis.rootCause,evidence:diagnosis.evidence,confidence:diagnosis.confidence},files})},
 ])
 if(!Array.isArray(result.changes)||!result.changes.length)return output(false,result.summary||'Geen autonome fix gevonden.')
 const context=new Set(diagnosis.affectedPaths)
 for(const change of result.changes){
  if(!context.has(change.path)||!editable(change.path)||typeof change.content!=='string')throw new Error('AI wijziging buiten begrensde context geweigerd: '+change.path)
  await writeFile(change.path,change.content,'utf8')
 }
 output(true,result.summary||'Autonome fix voorbereid.')
}
function output(changed,summary){
 const out=process.env.GITHUB_OUTPUT
 if(out)requireWrite(out,`changed=${changed?'true':'false'}\nsummary<<EOF\n${String(summary).slice(0,2000)}\nEOF\n`)
 console.log(summary)
}
function requireWrite(path,text){execFileSync('bash',['-lc',`cat >> "$1" <<'__UPT__'\n${text}__UPT__`,'_',path])}

function runValidation(){
 const commands=[
  ['npm',['run','lint']],['npm',['run','typecheck']],['npm',['test']],
  ['npm',['run','build:next']],['npm',['run','build:cloudflare']],
  ['npx',['wrangler','deploy','--dry-run']],
 ]
 for(const [cmd,args] of commands){
  try{sh(cmd,args,{stdio:['ignore','pipe','pipe']})}
  catch(error){
   const stderr=String(error.stderr||'')
   const stdout=String(error.stdout||'')
   return {ok:false,feedback:(cmd+' '+args.join(' ')+' failed\\n'+stdout+'\\n'+stderr).slice(-12000)}
  }
 }
 return {ok:true,feedback:''}
}
function commitAndPush(){
 sh('git',['config','user.name','UpTillDawn Self-Healing AI'])
 sh('git',['config','user.email','self-healing@users.noreply.github.com'])
 sh('git',['add','--all'])
 try{sh('git',['diff','--cached','--quiet']);return false}catch{}
 sh('git',['commit','-m',`fix(self-heal): repair error ${reportId}`])
 sh('git',['pull','--rebase','origin','main'])
 sh('git',['push','origin','HEAD:main'])
 return true
}
async function releaseCheck(){
 try{await verify();return {ok:true,feedback:''}}
 catch(error){return {ok:false,feedback:String(error?.message||error).slice(0,12000)}}
}
async function loop(){
 const base=sh('git',['rev-parse','HEAD'])
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  console.log(`Self-healing attempt ${attempt}/${maxAttempts}: evidence -> root cause -> bounded fix -> full validation -> CI -> deploy`)
  if(attempt>1){
   sh('git',['reset','--hard',base])
   sh('git',['clean','-fd'])
  }
  let changed=false
  const original=process.env.GITHUB_OUTPUT
  process.env.GITHUB_OUTPUT=''
  try{
   await propose()
   changed=sh('git',['status','--porcelain']).length>0
  }finally{process.env.GITHUB_OUTPUT=original}
  if(!changed){repairFeedback='AI produced no bounded change. '+repairFeedback;continue}
  const validation=runValidation()
  if(!validation.ok){repairFeedback=validation.feedback;console.error(repairFeedback);continue}
  if(!commitAndPush()){repairFeedback='Validated proposal contained no committable change.';continue}
  const released=await releaseCheck()
  if(released.ok){await markResolved();console.log('Self-healing release verified and report marked auto_resolved.');return}
  repairFeedback=released.feedback
  console.error(repairFeedback)
 }
 console.error(`Autonomous repair exhausted ${maxAttempts} attempts. Report remains registered for technical follow-up. Last evidence: ${repairFeedback}`)
 throw new Error('Self-healing kon de fout niet autonoom oplossen na '+maxAttempts+' pogingen.')
}

async function verify(){
 const sha=sh('git',['rev-parse','HEAD'])
 const deadline=Date.now()+18*60*1000
 let ci=null
 while(Date.now()<deadline){
  const runs=JSON.parse(sh('gh',['api',`repos/${repo}/actions/runs?head_sha=${sha}&per_page=20`]))
  ci=runs.workflow_runs?.find(x=>x.name==='CI')
  if(ci?.status==='completed')break
  await new Promise(r=>setTimeout(r,15000))
 }
 if(!ci||ci.conclusion!=='success')throw new Error('Self-healing CI werd niet groen.')
 let deploy=null
 while(Date.now()<deadline){
  const runs=JSON.parse(sh('gh',['api',`repos/${repo}/actions/runs?head_sha=${sha}&per_page=30`]))
  deploy=runs.workflow_runs?.find(x=>x.name==='Deploy Cloudflare'&&x.conclusion==='success')
  if(deploy)break
  await new Promise(r=>setTimeout(r,15000))
 }
 if(!deploy)throw new Error('Productiedeploy werd niet bevestigd.')
 const base=(process.env.NEXT_PUBLIC_APP_URL||'https://crew.uptilldawn.workers.dev').replace(/\/$/,'')
 const target=route.startsWith('/')&&!route.startsWith('//')?base+route.split('?')[0]:base
 const response=await fetch(target,{redirect:'manual'})
 if(response.status>=500)throw new Error('Productiecontrole faalt met HTTP '+response.status)
 console.log(`Self-healing bevestigd: CI #${ci.run_number}, deploy #${deploy.run_number}, HTTP ${response.status}`)
}
async function markResolved(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||''
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 if(!url||!key||!reportId){console.warn('Report resolution skipped: Supabase service credentials unavailable.');return}
 const response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/upt_self_heal_resolve_error_report`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_report:reportId})})
 if(!response.ok)console.warn('Report resolution RPC unavailable; release remains verified.')
}

async function escalate(extra=''){
 const title=`[Self-healing] Makeractie nodig · ${reportId}`
 const body=[
  'De autonome herstelcontroller kon geen voldoende zekere, begrensde codefix publiceren.',
  '',`**Route:** ${route}`,`**Fout:** ${errorName}: ${errorMessage}`,
  aiSummary?`**AI-diagnose:** ${aiSummary}`:'',
  extra?`**Autonome herstelresultaat:** ${extra}`:'',
  '','Controleer dit rapport in God Mode. Mogelijke oorzaken: database/configuratie/secret/externe dienst of onvoldoende zekere codewijziging.'
 ].filter(Boolean).join('\n')
 sh('gh',['issue','create','--repo',repo,'--title',title,'--body',body])
}
const command=process.argv[2]
if(command==='loop')await loop()
else if(command==='propose')await propose()
else if(command==='verify')await verify()
else if(command==='escalate')await escalate()
else throw new Error('Onbekend self-heal commando.')
