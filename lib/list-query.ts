/** Parse a page from URL/form input without accepting numeric coercions. */
export function listPage(value:unknown,maximum=100000):number{
 if(typeof value!=='string'||!/^[1-9][0-9]{0,5}$/.test(value))return 1
 return Math.min(Number(value),maximum)
}

/** Escape PostgreSQL LIKE wildcards so searches use the entered text. */
export function escapeLikeSearch(value:string):string{
 return value.replace(/[\\%_]/g,character=>'\\'+character)
}
