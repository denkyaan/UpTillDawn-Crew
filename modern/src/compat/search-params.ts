// Match Next's page props: repeated URL fields are arrays, in URL order.
export function originalSearchParams(search:string):Record<string,string|string[]>{
 const entries=new Map<string,string|string[]>()
 for(const [name,value]of new URLSearchParams(search)){
  const previous=entries.get(name)
  entries.set(name,previous===undefined?value:Array.isArray(previous)?[...previous,value]:[previous,value])
 }
 return Object.fromEntries(entries)
}
