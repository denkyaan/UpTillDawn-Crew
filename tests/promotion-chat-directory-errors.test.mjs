import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const page=readFileSync("app/(app)/portals/promotion/chats/page.tsx","utf8")

test("promotion chat reports directory failures without blocking chat access",()=>{
 assert.match(page,/\{data,error:directoryError\}=await db\.rpc\("upt_promotion_directory"/)
 assert.match(page,/directoryError&&<p role="alert"/)
 assert.match(page,/<PromotionChatsClient locale=\{locale\}/)
 for(const phrase of ["De namenlijst kon niet worden geladen","La liste des noms est indisponible","The member directory is unavailable","Das Mitgliederverzeichnis ist nicht verfügbar"])assert.ok(page.includes(phrase))
})
