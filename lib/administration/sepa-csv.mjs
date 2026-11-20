/** Strict CSV parser for offline SEPA drafts; never executes payments. */
export function parseSepaCsv(source) {
 if (typeof source !== 'string' || source.length > 2_000_000) throw Error('CSV size invalid')
 const rows=[]; let row=[],field='',quoted=false,afterQuote=false
 const input=source.replace(/^\uFEFF/,'')
 for(let i=0;i<input.length;i++){
  const c=input[i]
  if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++}else{quoted=false;afterQuote=true}}else field+=c;continue}
  if(afterQuote&&c!==','&&c!=='\r'&&c!=='\n')throw Error('Invalid CSV quote')
  if(c==='"'){if(field||afterQuote)throw Error('Invalid CSV quote');quoted=true;continue}
  if(c===','){row.push(field);field='';afterQuote=false;continue}
  if(c==='\r'||c==='\n'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';afterQuote=false;continue}
  field+=c
 }
 if(quoted)throw Error('Unclosed CSV quote')
 if(field!==''||row.length){row.push(field);rows.push(row)}
 if(rows.length<2||rows.length>1001)throw Error('Invalid CSV row count')
 const expected=['id','name','iban','amount','remittance']
 if(rows[0].length!==5||rows[0].some((h,i)=>h.trim().toLowerCase()!==expected[i]))throw Error('Expected CSV header: '+expected.join(','))
 return rows.slice(1).map((cells,i)=>{
  if(cells.length!==5)throw Error('Invalid CSV column count at row '+(i+2))
  const [id,name,iban,amount,remittance]=cells.map(c=>c.trim())
  if(!id||!name||!iban||!amount)throw Error('Missing required field at row '+(i+2))
  if(/[\u0000-\u001F\u007F]/.test(cells.join('')))throw Error('Control character at row '+(i+2))
  return {id,name,iban,amount,remittance}
 })
}
