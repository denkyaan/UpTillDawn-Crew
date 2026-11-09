import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseBrusselsRosterTime,RosterTimeError} from '../lib/administration/roster-local-time.ts'

const iso=(value)=>parseBrusselsRosterTime(value).toISOString()

test('roster: a winter date in Brussels uses UTC+01 (not the server timezone)',()=>{
 assert.equal(iso('2026-11-09T08:15'),'2026-11-09T07:15:00.000Z')
 assert.equal(iso('2026-01-01T00:15'),'2025-12-31T23:15:00.000Z')
})

test('roster: a summer date in Brussels uses UTC+02',()=>{
 assert.equal(iso('2026-07-09T08:15'),'2026-07-09T06:15:00.000Z')
 assert.equal(iso('2028-02-29T09:30'),'2028-02-29T08:30:00.000Z')
})

test('roster: reject the nonexistent spring DST hour',()=>{
 assert.throws(()=>iso('2026-03-29T02:30'),error=>error instanceof RosterTimeError&&error.reason==='missing')
 assert.equal(iso('2026-03-29T01:30'),'2026-03-29T00:30:00.000Z')
 assert.equal(iso('2026-03-29T03:30'),'2026-03-29T01:30:00.000Z')
})

test('roster: reject ambiguous repeated autumn DST hour instead of silently choosing',()=>{
 assert.throws(()=>iso('2026-10-25T02:30'),error=>error instanceof RosterTimeError&&error.reason==='ambiguous')
 assert.equal(iso('2026-10-25T01:30'),'2026-10-24T23:30:00.000Z')
 assert.equal(iso('2026-10-25T03:30'),'2026-10-25T02:30:00.000Z')
})

test('roster: reject tampered local dates and times',()=>{
 for(const value of [
  '2026-02-29T10:00','2026-04-31T10:00','2026-13-01T10:00',
  '2026-07-09T24:00','2026-07-09T12:60','2026-07-09T12:00Z',
  '2026-07-09T12:00+02:00','2026-07-09 12:00','2026-07-09',
  '','2000-01-01T01:00:00','1999-12-31T23:00'
 ]) assert.throws(()=>iso(value),error=>error instanceof RosterTimeError&&error.reason==='invalid',value)
})

test('roster server action and rendered times use explicit Belgian timezone',()=>{
 const page=readFileSync('app/(app)/portals/administration/rosters/page.tsx','utf8')
 assert.match(page,/parseBrusselsRosterTime\(start\)/)
 assert.match(page,/parseBrusselsRosterTime\(end\)/)
 assert.doesNotMatch(page,/new Date\(start\)|new Date\(end\)/)
 assert.match(page,/new Intl.DateTimeFormat\(locale,\{timeZone:"Europe\/Brussels"/)
 assert.match(page,/timeLabel\(p\.proposed_start\)/)
 assert.match(page,/timeLabel\(x\.scheduled_start\)/)
 for(const locale of ['nl','fr','en','de'])assert.match(page,new RegExp(locale+':\\{.*zone:'))
})

test('portal roles: directory search is server-paginated independently of role list',()=>{
 const page=readFileSync('app/(app)/portals/roles/page.tsx','utf8')
 const selector=readFileSync('app/(app)/portals/roles/role-management-form.tsx','utf8')
 assert.match(page,/searchParams:Promise<\{page\?:string;userPage\?:string;q\?:string\}>/)
 assert.match(page,/const directoryPage=listPage\(requestedUserPage,100000\)/)
 assert.match(page,/const directorySize=100/)
 assert.match(page,/range\(directoryOffset,directoryOffset\+directorySize-1\)/)
 assert.match(page,/ilike\('full_name','%'\+likeLiteral\(staffQuery\)\+'%'\)/)
 assert.match(page,/\.eq\('id',staffQuery\)/)
 assert.match(page,/\.eq\('approved',true\)\.eq\('account_blocked',false\)/)
 assert.match(page,/const displayedUserIds=\[\.\.\.new Set/)
 assert.match(page,/href\(\{userPage:directoryPage\+1\}\)/)
 assert.match(page,/href\(\{page:target\}\)/)
 assert.doesNotMatch(page,/\.limit\(500\)|===500/)
 assert.match(selector,/selectedUserVisible/)
})
