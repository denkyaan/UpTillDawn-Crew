/** Spreadsheet-safe UTF-8 CSV helpers for administrative finance exports. */
export function csvCell(value:unknown):string {
 const raw=String(value??'')
 const escaped=/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw
 return '"'+escaped.replaceAll('"','""')+'"'
}
export function financeCsv(rows:readonly (readonly unknown[])[]):string {
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'
}
export function financialAging(dueDate:string|null, today:string):'not_due'|'overdue_1_30'|'overdue_31_60'|'overdue_61_plus'|'no_due_date' {
 if(!dueDate)return 'no_due_date'
 const days=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(dueDate+'T00:00:00Z'))/86400000)
 if(!Number.isFinite(days))return 'no_due_date'
 return days<=0?'not_due':days<=30?'overdue_1_30':days<=60?'overdue_31_60':'overdue_61_plus'
}
