// Explicit tagged tuples avoid collisions with business objects and preserve
// FormData duplicates, Files, undefined and Dates without base64 upload copies.
export type Wire=unknown[]
export function encode(value:unknown,files:FormData,depth=0):Wire{
 if(depth>30)throw Error('Wire nesting limit')
 if(value===undefined)return ['undefined']
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return ['value',value]
 if(value instanceof Date)return ['date',value.toISOString()]
 if(value instanceof Blob){const id='file:'+Array.from(files.keys()).length;files.append(id,value,value instanceof File?value.name:'blob');return ['file',id]}
 if(value instanceof FormData)return ['form',Array.from(value,([k,v])=>[k,encode(v,files,depth+1)])]
 if(Array.isArray(value))return ['array',value.map(v=>encode(v,files,depth+1))]
 if(typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null))return ['object',Object.entries(value).map(([k,v])=>[k,encode(v,files,depth+1)])]
 throw Error('Unsupported wire value')
}
export function decode(wire:unknown,files:FormData,depth=0,budget={nodes:0}):unknown{
 if(depth>30||++budget.nodes>20_000||!Array.isArray(wire)||wire.length>2)throw Error('Invalid wire')
 const [type,value]=wire
 if(type==='undefined'&&wire.length===1)return undefined
 if(type==='value'&&(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)))return value
 if(type==='date'&&typeof value==='string'&&Number.isFinite(Date.parse(value)))return new Date(value)
 if(type==='file'&&typeof value==='string'&&value.startsWith('file:')){const file=files.get(value);if(!(file instanceof Blob))throw Error('Invalid file');return file}
 if(['array','form','object'].includes(type)&&Array.isArray(value)){
  if(type==='array')return value.map(v=>decode(v,files,depth+1,budget))
  const entries=value.map(entry=>{
   if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string')throw Error('Invalid entry')
   return [entry[0],decode(entry[1],files,depth+1,budget)] as const
  })
  if(type==='object')return Object.fromEntries(entries)
  const form=new FormData()
  for(const [name,item]of entries){if(typeof item!=='string'&&!(item instanceof Blob))throw Error('Invalid form field');form.append(name,item)}
  return form
 }
 throw Error('Invalid wire tag')
}
