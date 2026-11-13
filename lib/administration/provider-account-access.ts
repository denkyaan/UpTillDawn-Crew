/** Privacy-preserving JSON:API resource validator for read-only Ponto probes.
 * No IBAN, balances, transaction details, names or identifiers leave the Worker.
 */
export function validAccountAccess(data:unknown):"connected"|"needs_account_access"|"unavailable"{
 if(!data||typeof data!=="object"||Array.isArray(data)||!("data" in data)||!Array.isArray(data.data))return "unavailable"
 if(data.data.length===0)return "needs_account_access"
 const first=data.data[0] as unknown
 return first&&typeof first==="object"&&"type" in first&&first.type==="account"&&
  "id" in first&&typeof first.id==="string"&&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(first.id)?"connected":"unavailable"
}
