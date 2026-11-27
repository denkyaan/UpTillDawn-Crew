// The original handler signs out after a failed owner lookup. One bounded
// fresh-session retry is allowed only for that explicit technical response.
// It never substitutes a permission result, weakens authentication or retries
// credentials, denied roles, rate limits or verified identity failures.
export function mayRetryOwnerLookup({attempt,stage,status,code}){
 return attempt===0&&stage==='response'&&status===200&&code==='owner_lookup_error'
}
