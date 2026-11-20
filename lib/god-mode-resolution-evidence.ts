/** A model recommendation or a green unit test is not a verified bug fix. */
export type ReleaseTarget='main'|'production'
export type ErrorReportEvidence={id:string;status:string;created_at:string}
export type DeployEvidence={id:number;head_sha:string;status:string;conclusion:string|null;event:string;created_at:string;updated_at:string}
export type VerifiedClosure={ok:true;runId:number;sha:string;environment:ReleaseTarget}|{ok:false;reason:string}

const SHA=/^[a-f0-9]{40}$/i

/** Only a completed, current deployment strictly after the observed error can close it. */
export function evaluateReleaseEvidence(input:{
 environment:ReleaseTarget
 sha:string
 report:ErrorReportEvidence
 runs:DeployEvidence[]
 productionCurrentSha?:string|null
}):VerifiedClosure{
 const {environment,sha,report,runs,productionCurrentSha}=input
 if(!SHA.test(sha))return {ok:false,reason:'Gebruik de volledige commit-SHA van 40 tekens.'}
 if(report.status==='resolved'||report.status==='auto_resolved')
  return {ok:false,reason:'Het foutrapport is al afgesloten.'}
 const reported=Date.parse(report.created_at)
 if(!Number.isFinite(reported))
  return {ok:false,reason:'De oorspronkelijke foutdatum is niet betrouwbaar vastgelegd.'}
 if(environment==='production'&&productionCurrentSha!==sha)
  return {ok:false,reason:'Deze versie is niet bevestigd als de actuele productierelease.'}
 const successful=runs
  .filter(run=>run.status==='completed'&&run.conclusion==='success'&&SHA.test(run.head_sha)&&
    (environment==='main'?run.event==='workflow_run':run.event==='workflow_dispatch'))
  .sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))
 if(!successful.length)
  return {ok:false,reason:'Er is geen succesvol deploymentbewijs beschikbaar.'}
 const deployed=successful[0]
 if(deployed.head_sha!==sha)
  return {ok:false,reason:'De opgegeven SHA is niet de laatst succesvol gedeployde versie.'}
 const deployedAt=Date.parse(deployed.updated_at)
 if(!Number.isFinite(deployedAt)||deployedAt<reported)
  return {ok:false,reason:'De deployment is niet aantoonbaar nieuwer dan het foutrapport.'}
 return {ok:true,runId:deployed.id,sha,environment}
}
