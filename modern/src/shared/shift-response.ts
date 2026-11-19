// Client-side validation mirrors the existing audited upt_respond_shift RPC.
// Database permissions, start-time checks and capacity remain authoritative.
export function normalizeShiftDeclineReason(raw:unknown):string{
 if(typeof raw!=="string")throw new Error("invalid_shift_decline_reason")
 const value=raw.trim()
 if(value.length<3||value.length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
  throw new Error("invalid_shift_decline_reason")
 return value
}
