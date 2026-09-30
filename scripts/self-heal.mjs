import {readFile,writeFile,readdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'

const repo=process.env.GITHUB_REPOSITORY||'denkyaan/UpTillDawn-Crew'
const reportId=process.env.REPORT_ID||''
const route=process.env.ERROR_ROUTE||'/'
const errorName=process.env.ERROR_NAME||'Error'
const errorMessage=process.env.ERROR_MESSAGE||''
const stackTrace=process.env.STACK_TRACE||''
const aiSummary=process.env.AI_SUMMARY||''
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
async function propose(){
 const paths=await candidates()
 const selected=await ai([
  {role:'system',content:'Selecteer maximaal 8 relevante bronbestanden voor een minimale productiefout-fix. Kies alleen uit candidates. Geef uitsluitend JSON {paths:string[]}.'},
  {role:'user',content:JSON.stringify({route,errorName,errorMessage,stackTrace,aiSummary,candidates:paths})},
 ],1200)
 const chosen=[...new Set(selected.paths||[])].filter(p=>paths.includes(p)).slice(0,8)
 if(!chosen.length)return output(false,'Geen veilige bronselectie.')
 const files=[]
 let bytes=0
 for(const path of chosen){const content=await readFile(path,'utf8');bytes+=Buffer.byteLength(content);if(bytes<=140000)files.push({path,content})}
 const result=await ai([
  {role:'system',content:[
   'Je bent de begrensde self-healing programmeur van UpTillDawn Crew.',
   'Maak uitsluitend een minimale fix voor de gemelde fout.',
   'Geef JSON {summary,confidence,changes:[{path,content}]}. confidence is low, medium of high.',
   'content is steeds de volledige nieuwe bestandsinhoud.',
   'Wijzig uitsluitend bestanden die volledig in files zijn meegegeven.',
   'Geen database-migraties, workflows, secrets, dependencies, auth/RLS-versoepeling of nieuwe externe diensten.',
   'Behoud bestaande functionaliteit. Nieuwe zichtbare tekst vereist NL/FR/EN/DE-dekking.',
   'Gebruik confidence als diagnostische indicatie, niet als publicatiebeslissing. Als je na brononderzoek geen verantwoorde fix kunt formuleren: changes=[].',
  ].join('\n')},
  {role:'user',content:JSON.stringify({reportId,route,errorName,errorMessage,stackTrace,aiSummary,files})},
 ])
 if(!Array.isArray(result.changes)||!result.changes.length)return output(false,result.summary||'Geen autonome fix gevonden.')
 const context=new Set(files.map(x=>x.path))
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
async function escalate(){
 const title=`[Self-healing] Makeractie nodig · ${reportId}`
 const body=[
  'De autonome herstelcontroller kon geen voldoende zekere, begrensde codefix publiceren.',
  '',`**Route:** ${route}`,`**Fout:** ${errorName}: ${errorMessage}`,
  aiSummary?`**AI-diagnose:** ${aiSummary}`:'',
  '','Controleer dit rapport in God Mode. Mogelijke oorzaken: database/configuratie/secret/externe dienst of onvoldoende zekere codewijziging.'
 ].filter(Boolean).join('\n')
 sh('gh',['issue','create','--repo',repo,'--title',title,'--body',body])
}
const command=process.argv[2]
if(command==='propose')await propose()
else if(command==='verify')await verify()
else if(command==='escalate')await escalate()
else throw new Error('Onbekend self-heal commando.')
