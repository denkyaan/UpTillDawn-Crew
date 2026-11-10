// Explicit, fixed project routing. Browser input can only choose these keys.
export const GOD_PROJECTS={
  main:{projectId:'npbjrtiolqperdgljnhi',url:'https://npbjrtiolqperdgljnhi.supabase.co',label:'Main (test)'},
  production:{projectId:'eakoavcieossazqzplke',url:'https://eakoavcieossazqzplke.supabase.co',label:'Productie (live)'},
} as const

export type GodEnvironment=keyof typeof GOD_PROJECTS

export function isGodEnvironment(input:unknown):input is GodEnvironment{
  return input==='main'||input==='production'
}

export function canWriteGodSql(environment:GodEnvironment){
  return environment==='main'
}

export function isApprovedRuntime(runtimeUrl:string|undefined){
  return Object.values(GOD_PROJECTS).some(project=>project.url===runtimeUrl?.replace(/\/$/,''))
}
