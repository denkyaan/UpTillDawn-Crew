// Workers render server component dates in UTC. Client component formatters
// remain untouched and continue using the device timezone, as on Main.
export function originalDateString(value:unknown,method:string,locales?:Intl.LocalesArgument,options?:Intl.DateTimeFormatOptions):string{
 if(!(value instanceof Date))return (value as Record<string,(...args:unknown[])=>string>)[method](locales,options)
 const fn=value[method as 'toLocaleString'|'toLocaleDateString'|'toLocaleTimeString']
 return fn.call(value,locales===undefined||Array.isArray(locales)&&!locales.length?'en-US':locales,{...options,timeZone:options?.timeZone??'UTC'})
}
export function originalDateTimeFormat(locales?:Intl.LocalesArgument,options?:Intl.DateTimeFormatOptions){return new Intl.DateTimeFormat(locales===undefined||Array.isArray(locales)&&!locales.length?'en-US':locales,{...options,timeZone:options?.timeZone??'UTC'})}
