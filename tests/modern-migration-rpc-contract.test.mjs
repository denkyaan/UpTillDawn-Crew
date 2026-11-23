import test from "node:test"
import assert from "node:assert/strict"
import {execFileSync} from "node:child_process"
import {readFileSync} from "node:fs"
const file=p=>readFileSync(p,"utf8")
const metadata=JSON.parse(file("modern/scripts/rpc-reference.json"))
test("all candidate RPCs are review-allowlisted without live credentials",()=>{
 assert.equal(metadata.requiredPublicRpcNames.length,117)
 assert.ok(metadata.requiredPublicRpcNames.includes('upt_current_work_context'), 'Original signed incident access RPC must be explicitly reviewed')
 for(const rpc of ['upt_can_manage_administration','upt_ticket_sales_summary','upt_administration_finance_summary','upt_administration_payroll_rows'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Native administrative read must remain reviewed: '+rpc)
 for(const rpc of ['upt_god_session_valid','upt_god_role_rules','upt_god_error_reports','upt_god_data_catalog','upt_god_data_rows','upt_god_upload_security_audit','upt_current_effective_role','upt_is_approved'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Protected Maker/read RPC must be explicitly reviewed: '+rpc)
 for(const rpc of ['upt_guestlist_add_entry','upt_guestlist_update_entry','upt_guestlist_remove_entry','upt_guestlist_set_backstage_workplace','upt_guestlist_set_artist_hospitality','upt_sales_configure_item','upt_sales_set_opening_cash','upt_sales_refund','upt_generate_planning_recommendations','upt_apply_planning_recommendation','upt_dismiss_planning_recommendation','upt_generate_event_report'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Native admin business-action RPC not reviewed: '+rpc)
 for(const rpc of ['upt_set_feature_rollout','upt_snapshot_platform_configuration','upt_capture_event_template','upt_apply_event_template','upt_restore_platform_configuration','upt_save_automation_rule','upt_sync_workplace_catalog_to_event','upt_complete_event_onboarding_step','upt_mark_notification_read','upt_acknowledge_briefing','upt_acknowledge_personal_instruction'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Second-wave native RPC must be explicitly reviewed: '+rpc)
 for(const rpc of ['upt_close_event','upt_archive_event','upt_force_archive_event','upt_restore_event','upt_confirm_shift','upt_request_shift_change','upt_respond_shift_change','upt_cancel_shift_change','upt_decide_shift_change','upt_cancel_shift','upt_reassign_shift','upt_current_profile'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Third-wave shift or event RPC must be explicitly audited: '+rpc)
 for(const rpc of ['upt_create_inventory_item','upt_set_inventory_asset_details','upt_report_workplace_inventory_condition','upt_restock_inventory_item','upt_issue_inventory','upt_settle_inventory_issue','upt_request_inventory_settlement','upt_cancel_inventory_settlement','upt_decide_inventory_settlement','upt_restore_inventory_quantity','upt_apply_operational_checklist_template','upt_add_operational_checklist_item','upt_close_operational_checklist','upt_reopen_operational_checklist'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Fourth-wave inventory/checklist RPC requires explicit audit: '+rpc)
 for(const rpc of ['upt_create_shift','upt_update_shift','upt_save_shift_handover','upt_accept_shift_handover','upt_upsert_event_emergency_information','upt_respond_shift','upt_set_event_availability_with_reason'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Fifth-wave scheduling/handover RPC requires review: '+rpc)
 for(const name of ['upt_create_workplace_catalog','upt_update_workplace_catalog',
  'upt_create_workplace_catalog_item','upt_update_workplace_catalog_item',
  'upt_capture_event_template','upt_apply_event_template_v2',
  'upt_duplicate_event','upt_archive_event','upt_create_operational_checklist',
  'upt_sync_workplace_catalog_to_event'])
  assert.ok(metadata.requiredPublicRpcNames.includes(name),'Catalog/event SQL procedure not audited: '+name)
 assert.ok(metadata.requiredPublicRpcNames.includes('upt_is_admin'), 'Every native admin write must recheck original admin RPC')
 for(const rpc of ['upt_push_public_key','upt_notification_badge_count'])
  assert.ok(metadata.requiredPublicRpcNames.includes(rpc),'Original push read RPC needs an explicit native migration review: '+rpc)
 const out=JSON.parse(execFileSync(process.execPath,["modern/scripts/rpc-contract.mjs"],{encoding:"utf8"}))
 assert.equal(out.sourceRpcCount,117)
 assert.deepEqual(out.unreviewedRpc,[])
 assert.deepEqual(out.noLongerReferenced,[])
 assert.equal(out.liveDatabaseVerifiedInCi,false)
 assert.equal(out.productionCutoverAllowed,false)
})
test("Production-missing session contract is recorded and cannot be silently released",()=>{
 assert.deepEqual(metadata.lastObserved.production.missing,["upt_current_session_context"])
 assert.deepEqual(metadata.lastObserved.mainQa.missing,[])
 const script=file("modern/scripts/rpc-contract.mjs")
 assert.ok(script.includes('if(process.argv.includes("--release"))'))
 assert.throws(()=>execFileSync(process.execPath,["modern/scripts/rpc-contract.mjs","--release"],{stdio:"pipe"}))
})
test("RPC audit checks stay candidate-only and do not expand the workflow inventory",()=>{
 const ci=file(".github/workflows/fast-change-validation.yml")
 assert.ok(ci.includes("npm --prefix modern run rpc:contract"))
 assert.ok(ci.includes("github.event_name == 'pull_request' && startsWith(github.head_ref, 'migration/')"))
 assert.ok(!file("modern/scripts/rpc-contract.mjs").includes("fetch("))
 assert.ok(!file("modern/scripts/rpc-contract.mjs").includes("service_role"))
})
