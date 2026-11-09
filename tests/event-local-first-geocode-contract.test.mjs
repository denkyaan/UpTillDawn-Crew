import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("all event create and update actions leave manual address geocoding offline-first",()=>{
 for(const path of ["lib/actions/uptilldawn.ts","lib/actions/events.ts"]){
  const actions=source(path)
  const start=actions.indexOf("async function eventLocation(")
  const end=actions.indexOf("\n}",start)
  assert.ok(start>=0&&end>start,path)
  const location=actions.slice(start,end)
  assert.doesNotMatch(location,/geocodeGeoapify\s*\(/,path)
  assert.doesNotMatch(location,/fetch\s*\(/,path)
  assert.match(location,/fd\.get\('venue'\)/,path)
  assert.match(location,/fd\.get\('address'\)/,path)
  assert.match(location,/fd\.get\('latitude'\)/,path)
  assert.match(location,/fd\.get\('longitude'\)/,path)
  assert.match(location,/\(latitude===null\)!==\(longitude===null\)/,path)
  assert.match(location,/return \{venue,address,latitude,longitude\}/,path)
 }
 const crew=source("lib/actions/uptilldawn.ts")
 assert.match(crew,/latitude:location\.latitude,longitude:location\.longitude/)
 assert.match(crew,/eventLocation\(fd/)
 assert.match(crew,/if\(useOnlineRoute\)\{/)
 assert.match(crew,/geocodeGeoapify\(event\.address\)/)
})

test("manual event coordinates are visibly required for real GPS radius checks",()=>{
 const fields=source("components/events/geoapify-place-fields.tsx")
 assert.match(fields,/onlineLookup,setOnlineLookup\]=useState\(false\)/)
 assert.match(fields,/GPS-check-in/)
 assert.match(fields,/Verified coordinates are required for GPS check-in/)
 assert.match(fields,/name="latitude"/)
 assert.match(fields,/name="longitude"/)
 assert.match(fields,/required=\{Boolean\(longitude\)\}/)
 assert.match(fields,/required=\{Boolean\(latitude\)\}/)
})

test("local-first event actions preserve authorization, review and optional external imports",()=>{
 const eventActions=source("lib/actions/events.ts")
 const crewActions=source("lib/actions/uptilldawn.ts")
 assert.match(eventActions,/adminClient\(\)/)
 assert.match(crewActions,/adminClient\(\)/)
 assert.match(eventActions,/facebookUrl\?await fetchFacebookEventInfo/)
 assert.match(crewActions,/facebookUrl\?await fetchFacebookEventInfo/)
 // The event must be saved with verified coordinates, not an unverified inferred point.
 assert.match(eventActions,/latitude:location\.latitude,longitude:location\.longitude/)
 assert.match(crewActions,/latitude:location\.latitude,longitude:location\.longitude/)
})
