import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('administration subtabs use client-side links and preserve their target',()=>{
 const source=readFileSync('components/administration/administration-navigation.tsx','utf8')
 assert.match(source,/<Link key=\{slug\} data-administration-subtab=\{slug\} href=\{route\(slug\)\}/)
 assert.doesNotMatch(source,/<a key=\{slug\} data-administration-subtab=\{slug\}/)
 assert.match(source,/href=\{route\(slug\)\} onClick=\{\(\)=>setSelectedCategory\(\{key:"overview",pathname\}\)\}/)
})
test('login clears stale return targets and confines portal return navigation',()=>{
 const login=readFileSync('components/auth/login-form.tsx','utf8')
 const restore=readFileSync('components/auth/return-after-login.tsx','utf8')
 assert.match(login,/else \{\s*window.sessionStorage.removeItem/)
 assert.match(restore,/destination.origin!==window.location.origin/)
 assert.match(restore,/!path.startsWith\(currentPortal\+'\/'\)/)
})

test('post-login return targets are normalized and validated across portals',()=>{
 const restore=readFileSync('components/auth/return-after-login.tsx','utf8')
 assert.match(restore,/new URL\(target,window\.location\.origin\)/)
 assert.match(restore,/destination\.origin!==window\.location\.origin/)
 assert.match(restore,/\/%2f\|%5c\/i\.test\(target\)/)
 assert.match(restore,/path!==currentPortal && !path\.startsWith\(currentPortal\+'\/'\)/)
 assert.match(restore,/router\.replace\(path\+destination\.search\+destination\.hash\)/)
})
