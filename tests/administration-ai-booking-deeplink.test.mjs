import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=path=>readFileSync(path,"utf8")
test("artist booking links directly to its own AI notes editor",()=>{
 const detail=read("app/(app)/portals/administration/modules/artists/[id]/page.tsx")
 const page=read("app/(app)/portals/administration/modules/ai/page.tsx")
 const chat=read("components/administration/administration-ai-chat.tsx")
 const editor=read("components/administration/administration-ai-booking-notes.tsx")
 assert.match(detail,/modules\/ai\?bookingId=\$\{booking\.id\}/)
 assert.match(page,/initialBookingId=\{initialBookingId\}/)
 assert.match(chat,/initialBookingId=\{initialBookingId\}/)
 assert.match(editor,/encodeURIComponent\(targetId\)/)
 assert.match(editor,/initialBookingId&&/)
})
