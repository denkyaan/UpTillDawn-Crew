export type MakerItem={action?:string|null;entityType?:string|null;at?:string|null;
 type?:string|null;status?:string|null;name?:string|null;route?:string|null;
 severity?:string|null;needsMaker?:boolean;count?:number|null}
export type Diagnostics={audit:MakerItem[];recovery:MakerItem[];errors:MakerItem[]}
export type MakerPulse={errors:number;critical:number;needsMaker:number;failedRecovery:number}
const severe=new Set(["critical","high"])
const failures=new Set(["failed","failure","error","critical","unhealthy"])
const str=(v:unknown)=>typeof v==="string"?v.toLowerCase():""
export function isSevere(item:MakerItem):boolean{
 return severe.has(str(item.severity))
}
export function isFailedRecovery(item:MakerItem):boolean{
 return failures.has(str(item.status))
}
export function makerPulse(value:Diagnostics):MakerPulse{
 return {errors:value.errors.length,critical:value.errors.filter(isSevere).length,
  needsMaker:value.errors.filter(item=>item.needsMaker===true).length,
  failedRecovery:value.recovery.filter(isFailedRecovery).length}
}
export function visibleMakerErrors(rows:readonly MakerItem[],options:{
 onlyAction:boolean;search:string
}):MakerItem[]{
 const needle=options.search.trim().toLowerCase().slice(0,100)
 return rows.filter(item=>(!options.onlyAction||item.needsMaker===true)&&
  (!needle||[item.name,item.route,item.severity,item.status].some(value=>
   str(value).includes(needle))))
  .sort((a,b)=>Number(b.needsMaker===true)-Number(a.needsMaker===true)||
   Number(isSevere(b))-Number(isSevere(a))||
   (Date.parse(b.at||"")||0)-(Date.parse(a.at||"")||0))
}
export function checkedDiagnostics(data:unknown):Diagnostics{
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid_diagnostics")
 const value=data as Record<string,unknown>
 for(const key of ["errors","recovery","audit"]){
  const rows=value[key]
  if(!Array.isArray(rows)||rows.length>25||
   rows.some(row=>!row||typeof row!=="object"||Array.isArray(row)))
   throw Error("invalid_diagnostics")
 }
 return {errors:value.errors as MakerItem[],recovery:value.recovery as MakerItem[],
  audit:value.audit as MakerItem[]}
}
