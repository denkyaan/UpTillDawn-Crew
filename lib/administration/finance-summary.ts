/** Validate untrusted finance-summary RPC data before display or CSV export. */
export const financeSummaryKeys=['unpaid','partial','settled','overpaid'] as const
export type FinanceSummary=Record<(typeof financeSummaryKeys)[number],string>
export function validateFinanceSummary(value:unknown):value is FinanceSummary{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const record=value as Record<string,unknown>
 return financeSummaryKeys.every(key=>typeof record[key]==='string'&&/^\\d+$/.test(record[key])&&BigInt(record[key])<=BigInt(Number.MAX_SAFE_INTEGER))
}
