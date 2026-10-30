import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationNavigationGroups} from '../lib/administration/navigation.ts'
const nav=readFileSync('components/administration/administration-navigation.tsx','utf8')
test('all administration subtabs have contextual icons',()=>{
 const slugs=administrationNavigationGroups.flatMap(group=>group.slugs)
 const map=nav.slice(nav.indexOf('const subtabIcons:'),nav.indexOf('export function AdministrationNavigation'))
 for(const slug of slugs)assert.ok(map.includes(slug.includes('-')?'"'+slug+'"':slug+':'),slug+' icon missing')
 assert.match(nav,/const Icon=subtabIcons\[slug\]/)
})
test('mobile navigation has fixed category and subtab controls without popup',()=>{
 assert.doesNotMatch(nav,/ChevronDown|setOpened|absolute inset-x-0 bottom-full/)
 assert.match(nav,/aria-pressed=\{selected\.key===group\.key\}/)
 assert.match(nav,/className="fixed inset-x-0 bottom-0/)
})

test('subtabs remain compact and accessible on mobile',()=>{
 assert.match(nav,/grid grid-cols-3 gap-1\.5/)
 assert.match(nav,/aria-current=\{pathname===route\(slug\)\?"page":undefined\}/)
 assert.match(nav,/administrationCategoryForPath\(pathname\)/)
 assert.doesNotMatch(nav,/overflow-y-auto|bottom-full/)
})
test('administration layout reserves space for fixed navigation',()=>{
 const layout=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')
 assert.match(layout,/pb-64 lg:pb-0/)
})
