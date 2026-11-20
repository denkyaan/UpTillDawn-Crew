import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const chatPage=readFileSync("app/(app)/chat/page.tsx","utf8")
const promotion=readFileSync("app/(app)/portals/promotion/chats/page.tsx","utf8")
test("promotion chat keeps the directory error visible while sharing canonical group chat",()=>{
 assert.match(chatPage,/promotionDirectory=promotionOnly\?await s\.rpc\('upt_promotion_directory'\)/)
 assert.match(chatPage,/promotionOnly&&promotionDirectory\?\.error&&<p role="alert"/)
 assert.match(promotion,/<SharedChatPage promotionOnly/)
 for(const phrase of ["De namenlijst kon niet worden geladen","La liste des noms est indisponible","The member directory is unavailable","Das Mitgliederverzeichnis ist nicht verfügbar"])assert.ok(chatPage.includes(phrase))
})
