// Compile the real production-shaped frontend and Worker without contacting
// Production or reading any real credential. The fixture key is deliberately
// non-working. Never invoke wrangler without --dry-run.
import {execFileSync} from "node:child_process"
import {mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from "node:fs"
import {resolve} from "node:path"
import {releaseTopology,assertRehearsalBuildScope} from "./standalone-release-plan.mjs"
import {MAIN_QA_DATABASE,PRODUCTION_DATABASE} from "../src/api/runtime-scope.ts"
const modern=resolve(import.meta.dirname,"..")
const plan=releaseTopology(),profile=plan.production
const out=resolve(modern,".standalone-production-dist")
const config=resolve(modern,".wrangler-standalone-production-preflight.jsonc")
const env={...process.env,VITE_SUPABASE_URL:PRODUCTION_DATABASE,VITE_SUPABASE_ANON_KEY:profile.vars.SUPABASE_ANON_KEY,VITE_MIGRATION_ALLOW_WRITES:"false",VITE_MIGRATION_SCANNING_ENABLED:"false"}
// Do not forward any Cloudflare credentials or CI bot password to this rehearsal.
for(const key of Object.keys(env))if(/CLOUDFLARE|CF_API|SERVICE_ROLE|SUPABASE_SECRET|QA_PASSWORD|BOT_PASSWORD/i.test(key))delete env[key]
assertRehearsalBuildScope(profile,env)
const run=(binary,args)=>execFileSync(process.execPath,[resolve(modern,"node_modules",binary),...args],{cwd:modern,env,stdio:"inherit",timeout:240000})
try{
 rmSync(out,{recursive:true,force:true})
 run("vite/bin/vite.js",["build","--outDir",out])
 const js=readdirSync(resolve(out,"assets")).filter(x=>x.endsWith(".js"))
 const bundle=js.map(x=>readFileSync(resolve(out,"assets",x),"utf8"))
 const hasConfiguredDatabase=bundle.some(x=>x.includes(PRODUCTION_DATABASE))
 const hasFixtureKey=bundle.some(x=>x.includes(profile.vars.SUPABASE_ANON_KEY))
 const hasQaKey=bundle.some(x=>x.includes(plan.main.vars.SUPABASE_ANON_KEY))
 // Worker source contains both known project URLs as guards; the browser build
 // must contain the production public fixture config, never the actual QA key.
 if(!hasConfiguredDatabase||!hasFixtureKey||hasQaKey)throw Error("PRODUCTION_BROWSER_CONFIGURATION_MISMATCH")
 writeFileSync(config,JSON.stringify({...profile,assets:{...profile.assets,directory:"./.standalone-production-dist"}},null,2)+"\n")
 run("wrangler/bin/wrangler.js",["deploy","--dry-run","--config",config,"--outdir",".wrangler-standalone-production-preflight"])
 const reportDir=resolve(modern,"../test-results/modern-standalone-preflight")
 mkdirSync(reportDir,{recursive:true})
 writeFileSync(resolve(reportDir,"production-build.json"),JSON.stringify({fixtureBuildCompiled:true,workerDryRun:true,project:PRODUCTION_DATABASE,qaProject:MAIN_QA_DATABASE,usesRealProductionKey:false,productionDatabaseContacted:false,productionReady:false,deployed:false},null,2)+"\n")
}finally{
 rmSync(config,{force:true})
 rmSync(out,{recursive:true,force:true})
}
