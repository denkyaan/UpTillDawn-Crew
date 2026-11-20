// Pure validation rules are shared across Node regression tests and React,
// without importing Supabase clients, browser storage, or Worker secrets.
export type EvidenceVerdict="verified"|"rejected"|"inconclusive"
export function validReviewReason(reason:string):string{
 const clean=reason.trim()
 if(clean.length<10||clean.length>1000)throw new Error("review_reason_required")
 return clean
}
export function validateCheckinDecision(approve:boolean,notes:string):string|null{
 if(typeof approve!=="boolean")throw new Error("invalid_checkin_decision")
 const clean=notes.trim()
 if(!approve&&(clean.length<3||clean.length>500))throw new Error("checkin_rejection_reason_required")
 if(clean.length>500)throw new Error("checkin_reason_too_long")
 return approve?null:clean
}
