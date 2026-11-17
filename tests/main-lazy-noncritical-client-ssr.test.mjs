import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const shell=readFileSync('components/layout/app-layout.tsx','utf8')
const layout=readFileSync('app/(app)/layout.tsx','utf8')
const deferred=readFileSync('components/crew/lazy-offline-content-sync.tsx','utf8')
const offline=readFileSync('components/crew/global-offline-content-sync.tsx','utf8')

test('Admin/Administration AI panels are loaded only after user opens them, not in every Staff SSR response',()=>{
 assert.match(shell,/import dynamic from "next\/dynamic"/)
 assert.match(shell,/const PlatformAiAssistant = dynamic\(\(\) => import\("@\/components\/admin\/platform-ai-assistant"\)/)
 assert.match(shell,/const AdministrationAiChat = dynamic\(\(\) => import\("@\/components\/administration\/administration-ai-chat"\)/)
 assert.equal((shell.match(/\{ssr:false\}/g)||[]).length,2)
 assert.match(shell,/adminAiOpen&&/)
 assert.match(shell,/<PlatformAiAssistant contextKey=/)
 assert.match(shell,/<AdministrationAiChat locale=/)
})

test('Offline snapshot work remains mounted in authenticated App layout but does not block server rendering',()=>{
 assert.match(layout,/<LazyOfflineContentSync userId=\{user\.id\}\/>/)
 assert.match(deferred,/import dynamic from 'next\/dynamic'/)
 assert.match(deferred,/import\('\.\/global-offline-content-sync'\)/)
 assert.match(deferred,/\{ssr:false\}/)
 assert.match(deferred,/<OfflineSync userId=\{userId\}\/>/)
 assert.match(offline,/syncOfflineContent\(/)
 assert.match(offline,/const snapshotSignal=AbortSignal\.timeout\(12_000\)/)
 assert.match(offline,/snapshotResults\.some\(result=>Boolean\(result\.error\)\)\)return/)
 assert.match(offline,/replaceOfflineDocuments\(userId,offlineDocuments\)/)
})
