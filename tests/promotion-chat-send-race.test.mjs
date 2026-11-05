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
