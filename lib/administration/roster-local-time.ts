/**
 * Interpret a datetime-local control as a wall clock in Europe/Brussels.
 * Date.parse("YYYY-MM-DDTHH:mm") interprets it in the server runtime's
 * timezone (UTC on Cloudflare), silently moving Belgian crew rosters by
 * one/two hours. Never use the server's timezone for local roster inputs.
 *
 * DST gaps are invalid instants; the autumn repeated hour is ambiguous.
 * Reject both rather than choosing an offset without informing the planner.
 */
const BRUSSELS_TIME_ZONE = "Europe/Brussels"

const formatter = new Intl.DateTimeFormat("en-GB", {
 timeZone:BRUSSELS_TIME_ZONE,
 year:"numeric",month:"2-digit",day:"2-digit",
 hour:"2-digit",minute:"2-digit",hourCycle:"h23",
})

export class RosterTimeError extends Error {
 constructor(public readonly reason:"invalid"|"missing"|"ambiguous") {
  super(reason==="missing"
   ?"This local time does not exist in Europe/Brussels because the clock moves forward."
   :reason==="ambiguous"
    ?"This local time occurs twice in Europe/Brussels because the clock moves backward."
    :"Invalid Belgian local date and time.")
  this.name="RosterTimeError"
 }
}

export function parseBrusselsRosterTime(value:string):Date {
 // HTML datetime-local minute precision, future-oriented years 2000-2099.
 const match=/^(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
 if(!match)throw new RosterTimeError("invalid")
 const [year,month,day,hour,minute]=match.slice(1).map(Number)
 const utcWall=Date.UTC(year,month-1,day,hour,minute)
 const isoWall=new Date(utcWall).toISOString().slice(0,16)
 if(isoWall!==value)throw new RosterTimeError("invalid")

 // Europe/Brussels uses UTC+1 in winter, UTC+2 in summer. Check both
 // candidate instants against the real IANA timezone rather than assuming
 // a calendar rule, including transitions and future official rule changes.
 const matches=[60,120].map(minutes=>new Date(utcWall-minutes*60_000)).filter(date=>{
  const parts=Object.fromEntries(
   formatter.formatToParts(date).filter(part=>part.type!=="literal")
    .map(part=>[part.type,part.value]),
  )
  return Number(parts.year)===year&&Number(parts.month)===month&&
   Number(parts.day)===day&&Number(parts.hour)===hour&&
   Number(parts.minute)===minute
 })
 if(matches.length===0)throw new RosterTimeError("missing")
 if(matches.length>1)throw new RosterTimeError("ambiguous")
 return matches[0]
}
