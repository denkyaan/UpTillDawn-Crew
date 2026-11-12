import { redirect } from "next/navigation"

// Legacy URL only. Customer/supplier editing lives in one canonical workspace.
export default function AdministrationContactsAlias(){
 redirect("/portals/administration/counterparties")
}
