#!/usr/bin/env node
// Fail-closed documentation of the actual sign-in migration contract.
// IMPORTANT: passing a visual screenshot comparison does NOT validate
// authorization, role-mode switching, notifications or recovery workflows.
import {readFileSync} from "node:fs"
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8")
const legacy=read("lib/actions/auth.ts")
const modern=read("modern/src/lib/session.tsx")
const modernUi=read("modern/src/main.tsx")
const originalUi=read("modern/src/screens/original-auth.tsx")
const bridge=read("modern/src/api/main-auth.ts")
const originalForm=read("components/auth/login-form.tsx")
const required={
 portalChoice:legacy.includes("requestedPortal"),
 roleAccess:legacy.includes("assignedPortalAccess")&&legacy.includes("'wrong_portal'"),
 adminMode:legacy.includes("upt_set_admin_role_mode"),
 ownerMode:legacy.includes("isOwner === true"),
 adminAudit:legacy.includes("upt_admin_login_success"),
 securityNotifications:legacy.includes("sendSecurityLoginEmail"),
 pendingApproval:legacy.includes("/pending-approval"),
 forgotPassword:legacy.includes("export async function forgotPassword"),
 resetPassword:legacy.includes("export async function updatePassword"),
 fiveRoleEntry:legacy.includes("['staff', 'responsible', 'admin', 'promotion', 'administration']"),
}
if(Object.values(required).some(x=>x!==true))throw Error("LEGACY_LOGIN_CONTRACT_CHANGED_REBASE_REQUIRED")
const candidate={
 roleMenu:originalUi.includes('@/components/auth/login-form')&&
  ["staff","responsible","admin","promotion","administration"].every(portal=>originalForm.includes(portal)),
 authorityVerified:modern.includes("upt_current_session_context"),
 roleSwitch:bridge.includes('MAIN_AUTH.fetch')&&legacy.includes("upt_set_admin_role_mode"),
 adminLoginAudit:bridge.includes('MAIN_AUTH.fetch')&&legacy.includes("upt_admin_login_success"),
 securityNotifications:bridge.includes('MAIN_AUTH.fetch')&&legacy.includes("sendSecurityLoginEmail"),
 pendingApproval:modernUi.includes("/pending-approval"),
 resetPassword:modernUi.includes("/forgot-password"),
 emailCallbackVerified:false,
}
console.log(JSON.stringify({loginCutoverAllowed:false,
 exactSourceOfTruth:"existing Main authenticated portal-login",
 legacyContract:required,candidateCapabilities:candidate,
 visualEvidenceRequired:"npm --prefix modern run login:visual-parity (48 screens + 160 interaction screenshot comparisons)",
 functionalEvidenceRequired:"live, role-scoped and denial E2E with same auth/audit/reset outcomes in Main QA",
 reason:"Visual snapshots alone do not prove login/role/security parity; no full acceptance evidence",
 productionUntouched:true},null,2))
console.error("LOGIN_CUTOVER_BLOCKED: all five portal paths, appearance and server-side auth behavior must pass real parity tests.")
process.exitCode=1
