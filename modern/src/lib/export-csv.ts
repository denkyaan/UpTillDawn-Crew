// Spreadsheet-compatible CSV produced entirely on the user's device.
// No XLSX/PDF library or Worker invocation is necessary for basic exports.
// Escape RFC4180 commas/quotes/CRLF AND neutralize spreadsheet formulas.
export type CsvCell=string|number|boolean|null|undefined
export function csvCell(value:CsvCell):string{
 let text=value===null||value===undefined?"":String(value)
 // Treat strings beginning (after whitespace/control chars) with Excel
 // formula operators as literal text; prevent CSV formula/DDE injection.
 if(typeof value==="string"&&/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text
 return '"'+text.replaceAll('"','""')+'"'
}
export function encodeCsv(headers:readonly string[],rows:readonly (readonly CsvCell[])[]):string{
 if(headers.length===0||headers.length>80)throw new Error("invalid_csv_headers")
 if(rows.length>10_000)throw new Error("csv_row_limit")
 if(rows.some(row=>row.length!==headers.length))throw new Error("csv_column_mismatch")
 return [headers.map(csvCell).join(";"),...rows.map(row=>row.map(csvCell).join(";"))].join("\r\n")+"\r\n"
}
export function downloadCsv(filename:string,headers:readonly string[],rows:readonly (readonly CsvCell[])[]):void{
 if(!/^[\w-]{1,100}\.csv$/i.test(filename))throw new Error("invalid_csv_filename")
 const body="\uFEFF"+encodeCsv(headers,rows)
 const url=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}))
 try{
  const a=document.createElement("a")
  a.href=url;a.download=filename;a.style.display="none"
  document.body.append(a);a.click();a.remove()
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
}
