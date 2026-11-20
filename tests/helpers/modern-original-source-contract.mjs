import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pages,routePath} from '../../modern/tooling/main-source.mjs'
const read=p=>readFileSync(p,'utf8')
export function assertOriginalSourceRoutes(){
 const main=read('modern/src/main.tsx'),app=read('modern/src/screens/original-application.tsx')
 assert.ok(main.includes('OriginalApplication'))
 assert.doesNotMatch(main,/screens\/(?:events|tasks|chats|finance|administration|promotion)["']/)
 for(const source of ['app/(app)/layout.tsx','app/(app)/portals/administration/layout.tsx','app/(app)/portals/promotion/layout.tsx'])assert.ok(app.includes('main-source/'+source))
 const paths=new Set(pages.map(routePath))
 for(const path of ['/','/admin','/events','/tasks','/workplaces','/operations','/chat','/settings','/qr','/maker-mode','/god-mode','/portals/administration','/portals/administration/finance','/portals/promotion'])assert.ok(paths.has(path),'Original route missing: '+path)
 assert.ok(app.includes('main-source/routes'))
 assert.ok(app.includes('<NotFound/>'))
 assert.doesNotMatch(main+app,/local-first candidate|legacyFallbackCopy|<iframe|className="notice"/)
 assert.ok(read('modern/scripts/inventory.mjs').includes('productionCutoverAllowed:false'))
}
