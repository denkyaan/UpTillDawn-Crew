import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const dispatch=readFileSync(new URL("../lib/administration/contract-signing-dispatch.ts",import.meta.url),"utf8")
const provider=readFileSync(new URL("../lib/administration/documenso-envelope.ts",import.meta.url),"utf8")
const config=readFileSync(new URL("../lib/administration/documenso.ts",import.meta.url),"utf8")
test("contract delivery checks the disabled signing feature gate",()=>{
 assert.match(dispatch,/if\(!signingDispatchEnabled\(\)\)throw/)
})
test("direct Documenso distribution cannot bypass disabled signing gate",()=>{
 assert.match(provider,/if\(!signingDispatchEnabled\(\)\)throw/)
 assert.match(config,/function signingDispatchEnabled\(\):false/)
})
