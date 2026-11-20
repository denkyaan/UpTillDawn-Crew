// A model diagnoses errors; it never verifies repairs or authorizes side effects.
// This policy is intentionally independent of the model and Cloudflare runtime.
export type ErrorAiCategory='transient'|'client_state'|'permission'|'data'|'code'|'database'|'configuration'|'network'|'unknown'
export type ErrorAiSeverity='low'|'medium'|'high'|'critical'
export type ErrorAiAction='none'|'retry'|'reload'
export type ErrorAiEvidence={
  route:string
  error_message:string
  error_name:string|null
  source?:string
  reported_count?:number
}
export type ModelErrorAssessment={
  category:ErrorAiCategory
  severity:ErrorAiSeverity
  summary:string
  userMessage:string
  autoAction:ErrorAiAction
  makerActionRequired:boolean
  makerAction:string|null
  godPrompt:string|null
}
export type CalibratedErrorDecision={
  status:'failed'
  category:ErrorAiCategory
  severity:ErrorAiSeverity
  summary:string
  userMessage:string
  autoAction:'none'|'reload'
  makerActionRequired:false
}

const severityRank:Record<ErrorAiSeverity,number>={low:0,medium:1,high:2,critical:3}
const maxSeverity=(left:ErrorAiSeverity,right:ErrorAiSeverity):ErrorAiSeverity=>
  severityRank[left]>=severityRank[right]?left:right

export function calibrateErrorDecision(evidence:ErrorAiEvidence,assessment:ModelErrorAssessment):CalibratedErrorDecision{
  const message=(evidence.error_message||'').toLowerCase()
  const permission=/permission denied|not authori[sz]ed|unauthorized|forbidden|geen toegang|access denied|row.level security|\brls\b/.test(message)
  const hydration=/react error #418|hydration mismatch|hydration failed|hydration error/.test(message)
  // The classifier may suggest a retry for a failed POST, payment or ticket scan.
  // Without action-specific idempotency evidence, no automatic retry is safe.
  const action:'none'|'reload'=hydration&&evidence.source==='boundary'?'reload':'none'
  const category=permission?'permission':hydration?'client_state':assessment.category
  let severity=assessment.severity
  if(permission)severity=maxSeverity(severity,'high')
  if((evidence.reported_count??1)>=5)severity=maxSeverity(severity,'high')
  const claimedFix=/\b(opgelost|hersteld|gerepareerd|fixed|resolved|repair complete|successfully repaired)\b/i.test(assessment.summary)
  const summary=claimedFix
    ?'AI-diagnose beschikbaar; de voorgestelde reparatie is nog niet onafhankelijk geverifieerd.'
    :assessment.summary
  const recommendation=action==='reload'
    ?'Je kunt de pagina handmatig herladen. Niet-opgeslagen gegevens kunnen verloren gaan.'
    :'Er wordt geen automatische actie uitgevoerd; de fout blijft open voor onderzoek.'
  return {
    // Only a separately verified fix may ever mark a report as resolved.
    status:'failed',
    category,
    severity,
    summary,
    userMessage:'De AI heeft de fout geanalyseerd, maar een oplossing is nog niet bevestigd. '+recommendation,
    autoAction:action,
    makerActionRequired:false,
  }
}
