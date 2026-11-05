import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const source=readFileSync("components/promotion/promotion-chats-client.tsx","utf8")

test("promotion chat prevents duplicate submissions before React state updates",()=>{
 assert.match(source,/if\(!message\|\|sending\.current\|\|/)
 assert.match(source,/sending\.current=true/)
 assert.match(source,/sending\.current=false/)
})

test("room switching is disabled while a message is being submitted",()=>{
 assert.match(source,/disabled=\{busy\} onClick=\{\(\)=>\{if\(sending\.current\)return/)
 assert.doesNotMatch(source,/setBusy\(false\)\}\} className/)
})

test("chat send lock is released even if the database request rejects",()=>{
 assert.match(source,/async function send\(\)[\s\S]*?try\{/)
 assert.match(source,/catch\{\s*setError\(l\.error\)/)
 assert.match(source,/finally\{\s*sending\.current=false\s*setBusy\(false\)/)
})

test("chat distinguishes failed history loading from an empty room",()=>{
 assert.match(source,/const \[loaded,setLoaded\]=useState\(false\)/)
 assert.match(source,/const \[loadFailed,setLoadFailed\]=useState\(false\)/)
 assert.match(source,/if\(failure\)\{setLoadFailed\(true\);setError\(l\.load\);return\}/)
 assert.match(source,/catch\{\s*if\(current!==sequence\.current\)return\s*setLoadFailed\(true\)/)
 assert.match(source,/!messages\.length&&loaded&&!loadFailed/)
})
