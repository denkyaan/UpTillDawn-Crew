/**
 * Cloudmersive OCR response normalization. Provider results are untrusted:
 * they are suggestions for human review, never financial or stock entries.
 */
export type OcrResult={text:string;pages:number;confidence:number|null}
const MAX_TEXT=25000

function boundedText(input:unknown):string{
 if(typeof input!=="string")return ""
 const content=input.replace(/\u0000/g,"").replace(/\r\n?/g,"\n").trim()
 return content.slice(0,MAX_TEXT)
}
function confidence(input:unknown):number|null{
 return typeof input==="number"&&Number.isFinite(input)&&input>=0&&input<=100?input:null
}
export function normalizeCloudmersiveOcr(payload:unknown,kind:"image"|"pdf"):OcrResult|null{
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return null
 const root=payload as Record<string,unknown>
 if(kind==="image"){
  const text=boundedText(root.TextResult)
  if(!text)return null
  return {text,pages:1,confidence:confidence(root.MeanConfidenceLevel)}
 }
 if(root.Successful===false)return null
 if(!Array.isArray(root.OcrPages)||!root.OcrPages.length)return null
 const pages=root.OcrPages.slice(0,30).filter((p):p is Record<string,unknown>=>Boolean(p&&typeof p==="object"&&!Array.isArray(p)))
 const texts=pages.map(p=>boundedText(p.TextResult)).filter(Boolean)
 if(!texts.length)return null
 const confidenceLevels=pages.map(p=>confidence(p.MeanConfidenceLevel)).filter((v):v is number=>v!==null)
 return {text:texts.join("\n\n").slice(0,MAX_TEXT),pages:pages.length,
  confidence:confidenceLevels.length?Math.round(confidenceLevels.reduce((sum,n)=>sum+n,0)/confidenceLevels.length):null}
}
export type OcrFileType="image/jpeg"|"image/png"|"application/pdf"
export function verifiedOcrFileType(bytes:Uint8Array,claimedType:string,name:string):OcrFileType|null{
 if(bytes.byteLength<8)return null
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255
 const pdf=bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45
 const ext=name.toLowerCase().split(".").pop()
 if(png&&ext==="png"&&claimedType==="image/png")return "image/png"
 if(jpg&&(ext==="jpg"||ext==="jpeg")&&claimedType==="image/jpeg")return "image/jpeg"
 if(pdf&&ext==="pdf"&&claimedType==="application/pdf")return "application/pdf"
 return null
}
