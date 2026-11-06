/** Validate calendar dates before sending filters to PostgREST. */
export function validInvoiceDate(value:unknown):string {
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return ""
 const [year,month,day]=value.split("-").map(Number)
 const parsed=new Date(Date.UTC(year,month-1,day))
 return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day?value:""
}

/** Reject inverted date ranges instead of silently returning misleading results. */
export function invoiceDateRange(from:unknown,to:unknown){
 const start=validInvoiceDate(from)
 const end=validInvoiceDate(to)
 return start&&end&&start>end?{from:"",to:""}:{from:start,to:end}
}
